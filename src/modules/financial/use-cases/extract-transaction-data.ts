interface ExtractTransactionDataRequest {
  code: string;
}

interface ExtractTransactionDataResponse {
  success: boolean;
  payload: {
    amount: number;
    dueDate?: string;
    description: string;
    type: 'PIX' | 'BOLETO' | 'NFCE';
    rawCode: string;
  };
}

export class ExtractTransactionDataUseCase {
  async execute({ code }: ExtractTransactionDataRequest): Promise<ExtractTransactionDataResponse> {
    const rawCode = code.trim();

    // 1. NFC-e Check (URL)
    if (rawCode.startsWith('http') && (rawCode.includes('sefaz') || rawCode.includes('nfce') || rawCode.includes('sat'))) {
      return this.handleNfce(rawCode);
    }

    // 2. Pix Check (EMV QRCPS)
    if (rawCode.startsWith('000201')) {
      return this.handlePix(rawCode);
    }

    // 3. Boleto Check (Digits)
    const digitsOnly = rawCode.replace(/\D/g, '');
    if (digitsOnly.length >= 44 && digitsOnly.length <= 48) {
      // Validação de Checksum ANTES de processar
      if (!this.isValidBoleto(digitsOnly)) {
        throw new Error('Checksum do boleto inválido.');
      }
      return this.handleBoleto(digitsOnly);
    }

    throw new Error('Formato de código não reconhecido.');
  }

  private isValidBoleto(digits: string): boolean {
    if (digits.length === 47) return this.validateChecksum47(digits);
    if (digits.length === 48) return this.validateChecksum48(digits);
    if (digits.length === 44) return true; // Barcode puro não tem os CDs da linha digitável, validação diferente (omitida por brevidade ou tratada no parser)
    return false;
  }

  private validateChecksum47(digits: string): boolean {
    // Boletos Bancários: 3 blocos com CD Mod 10
    const blocks = [
      { data: digits.substring(0, 9), cd: digits.substring(9, 10) },
      { data: digits.substring(10, 20), cd: digits.substring(20, 21) },
      { data: digits.substring(21, 31), cd: digits.substring(31, 32) }
    ];

    return blocks.every(block => this.mod10(block.data) === parseInt(block.cd));
  }

  private validateChecksum48(digits: string): boolean {
    // Concessionárias: 4 blocos com CD Mod 10 ou 11
    const isMod10 = ['6', '7'].includes(digits[2]);
    const blocks = [
      { data: digits.substring(0, 11), cd: digits.substring(11, 12) },
      { data: digits.substring(12, 23), cd: digits.substring(23, 24) },
      { data: digits.substring(24, 35), cd: digits.substring(35, 36) },
      { data: digits.substring(36, 47), cd: digits.substring(47, 48) }
    ];

    const validator = isMod10 ? this.mod10.bind(this) : this.mod11.bind(this);
    return blocks.every(block => validator(block.data) === parseInt(block.cd));
  }

  private mod10(data: string): number {
    let sum = 0;
    let weight = 2;
    for (let i = data.length - 1; i >= 0; i--) {
      let res = parseInt(data[i]) * weight;
      if (res > 9) res = Math.floor(res / 10) + (res % 10);
      sum += res;
      weight = weight === 2 ? 1 : 2;
    }
    const remainder = sum % 10;
    const digit = 10 - remainder;
    return digit === 10 ? 0 : digit;
  }

  private mod11(data: string): number {
    let sum = 0;
    let weight = 2;
    for (let i = data.length - 1; i >= 0; i--) {
      sum += parseInt(data[i]) * weight;
      weight = weight === 9 ? 2 : weight + 1;
    }
    const remainder = sum % 11;
    if (remainder === 0 || remainder === 1) return 0;
    if (remainder === 10) return 1;
    return 11 - remainder;
  }

  private handlePix(code: string): ExtractTransactionDataResponse {
    const payload = {
      amount: 0,
      description: '',
      type: 'PIX' as const,
      rawCode: code,
    };

    let i = 0;
    while (i < code.length) {
      if (i + 4 > code.length) break;
      const tag = code.substring(i, i + 2);
      const length = parseInt(code.substring(i + 2, i + 4));
      if (isNaN(length)) break;
      const value = code.substring(i + 4, i + 4 + length);

      if (tag === '54') {
        payload.amount = parseFloat(value) || 0;
      } else if (tag === '59') {
        payload.description = value;
      } else if (tag === '62') {
        // Subtags de 62
        let j = 0;
        while (j < value.length) {
          const subTag = value.substring(j, j + 2);
          const subLen = parseInt(value.substring(j + 2, j + 4));
          if (isNaN(subLen)) break;
          const subVal = value.substring(j + 4, j + 4 + subLen);
          if (subTag === '05' && !payload.description) {
            payload.description = subVal;
          }
          j += 4 + subLen;
        }
      }

      i += 4 + length;
    }

    return {
      success: true,
      payload: {
        ...payload,
        description: payload.description || 'Pix Recebido',
      },
    };
  }

  private handleBoleto(digits: string): ExtractTransactionDataResponse {
    let amount = 0;
    let bankCode = '';
    let dueDateISO: string | undefined;
    let issuerName = '';

    // 1. Arrecadação / Concessionárias (Inicia com 8)
    if (digits.startsWith('8')) {
      bankCode = 'CONV';
      issuerName = this.getConcessionariaName(digits);
      
      // Reconstituição do código de 44 posições (removendo os 4 CDs da linha digitável)
      let raw44 = digits;
      if (digits.length === 48) {
        raw44 = digits.substring(0, 11) + 
                digits.substring(12, 23) + 
                digits.substring(24, 35) + 
                digits.substring(36, 47);
      }

      // No padrão de arrecadação de 44 posições, o valor nominal está entre 4 e 15 (11 dígitos)
      const valStr = raw44.substring(4, 15);
      amount = parseInt(valStr) / 100;
      
      // Extrair data de vencimento de concessionárias (posições 20-27 no formato AAAAMMDD ou DDMMYYYY)
      const dateStr = raw44.substring(19, 27); // Posições 20-27 (0-indexed 19-26)
      dueDateISO = this.extractConcessionariaDueDate(dateStr);
      
      return {
        success: true,
        payload: {
          amount,
          dueDate: dueDateISO,
          description: issuerName || 'PAGAMENTO CONCESSIONÁRIA',
          type: 'BOLETO' as const,
          rawCode: digits,
        },
      };
    }

    // 2. Boletos Bancários Tradicionais (47 ou 44 dígitos)
    let factor = 0;
    let amountStr = '';
    
    if (digits.length === 47) {
      bankCode = digits.substring(0, 3);
      // No 47 dígitos, o fator é pos 33-37 e valor 37-47
      factor = parseInt(digits.substring(33, 37));
      amountStr = digits.substring(37);
    } else if (digits.length === 44) {
      bankCode = digits.substring(0, 3);
      factor = parseInt(digits.substring(5, 9));
      amountStr = digits.substring(9, 19);
    }

    amount = parseInt(amountStr) / 100;
    
    // Fator de vencimento (Base 07/10/1997)
    if (factor > 0 && factor < 9999) {
      const baseDate = new Date(1997, 9, 7, 12, 0, 0); 
      const date = new Date(baseDate);
      date.setDate(baseDate.getDate() + factor);
      dueDateISO = date.toISOString();
    }

    issuerName = this.getBankName(bankCode);

    return {
      success: true,
      payload: {
        amount,
        dueDate: dueDateISO,
        description: issuerName,
        type: 'BOLETO' as const,
        rawCode: digits,
      },
    };
  }

  private handleNfce(url: string): ExtractTransactionDataResponse {
    const accessKeyMatch = url.match(/\d{44}/);
    const accessKey = accessKeyMatch ? accessKeyMatch[0] : '';
    
    let amount = 0;
    let dueDateISO: string | undefined;
    let description = '';
    
    try {
      const urlObj = new URL(url);
      const params = urlObj.searchParams;
      
      // 1. Extração e Normalização de Valor
      const rawAmount = params.get('vTotal') || params.get('vTot') || params.get('valorTotal') || params.get('vNF') || params.get('vlr');
      if (rawAmount) {
        if (!rawAmount.includes('.') && !rawAmount.includes(',') && rawAmount.length > 2) {
          // Caso como 33184 -> 331.84
          amount = parseInt(rawAmount) / 100;
        } else {
          amount = parseFloat(rawAmount.replace(',', '.'));
        }
      }
      
      // 2. Extração de Data
      const dhEmi = params.get('dhEmi') || params.get('dhE') || params.get('dt') || params.get('data');
      if (dhEmi) {
        const match = dhEmi.match(/^(\d{4})(\d{2})(\d{2})/);
        if (match) {
          dueDateISO = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3])).toISOString();
        } else if (!isNaN(Date.parse(dhEmi))) {
          dueDateISO = new Date(dhEmi).toISOString();
        }
      }

      // 3. Identificação do Emissor (Estabelecimento)
      const merchantName = params.get('nm') || params.get('fant') || params.get('emi') || params.get('xNome') || params.get('nome');
      if (merchantName) {
        description = merchantName;
      } else if (accessKey.length === 44) {
        // Extrai CNPJ da Chave de Acesso (posições 6 a 19)
        const cnpj = accessKey.substring(6, 20);
        description = `NF-e CNPJ: ${cnpj.substring(0, 2)}.${cnpj.substring(2, 5)}.${cnpj.substring(5, 8)}/${cnpj.substring(8, 12)}-${cnpj.substring(12, 14)}`;
        
        // Tentar extrair data da chave de acesso (posições 2-5: ano/mês)
        const year = parseInt(accessKey.substring(2, 4));
        const month = parseInt(accessKey.substring(4, 6));
        const fullYear = year < 50 ? 2000 + year : 1900 + year;
        
        // Se não temos data ainda, usar data da emissão da chave (primeiro dia do mês)
        if (!dueDateISO && month >= 1 && month <= 12) {
          dueDateISO = new Date(fullYear, month - 1, 1).toISOString();
        }
      } else {
        // Fallback para o domínio
        description = `NF-e: ${urlObj.hostname.replace('www.', '')}`;
      }

      // 4. Tentar extrair do parâmetro 'p' comum em URLs de NFC-e
      const pParam = params.get('p');
      if (pParam && !amount) {
        // Formato comum: chave|versao|tipo|digito
        const parts = pParam.split('|');
        if (parts.length >= 4) {
          // O valor geralmente está na parte 2 ou 3 (dependendo do formato)
          // Formatos comuns:
          // - chave|versao|tipo|digito
          // - chave|versao|tipo|digito|valor|...
          
          // Tentar partes específicas onde o valor geralmente está
          const possibleValueParts = [2, 3, 4, 5];
          for (const partIndex of possibleValueParts) {
            if (parts.length > partIndex) {
              const part = parts[partIndex];
              // Verificar se parece um valor monetário (não muito grande, pode ter vírgula/ponto)
              if (part && part.length > 0 && part.length < 10) {
                const cleanPart = part.replace(',', '.');
                const numValue = parseFloat(cleanPart);
                // Valores monetários razoáveis para NFC-e (0.01 a 99999.99)
                if (!isNaN(numValue) && numValue > 0.01 && numValue < 100000) {
                  amount = numValue;
                  break;
                }
              }
            }
          }
          
          // Se não encontrou nas posições esperadas, tentar qualquer parte
          if (!amount) {
            for (let i = 0; i < parts.length; i++) {
              const part = parts[i];
              if (part && part.length > 0 && part.length < 10) {
                const cleanPart = part.replace(',', '.');
                const numValue = parseFloat(cleanPart);
                if (!isNaN(numValue) && numValue > 0.01 && numValue < 100000) {
                  amount = numValue;
                  break;
                }
              }
            }
          }
        }
      }

    } catch (e) {
      description = `NFC-e: ${accessKey ? accessKey.slice(-8) : 'Scanner'}`;
    }
    
    // Se ainda não temos descrição, usar fallback genérico
    if (!description && accessKey) {
      description = `NFC-e ${accessKey.substring(0, 8)}...`;
    }
    
    return {
      success: true,
      payload: {
        amount,
        dueDate: dueDateISO,
        description: description.toUpperCase(),
        type: 'NFCE' as const,
        rawCode: url,
      },
    };
  }

  private getBankName(code: string): string {
    const bankMap: Record<string, string> = {
      '001': 'Banco do Brasil',
      '033': 'Santander',
      '041': 'Banrisul',
      '104': 'Caixa Econômica Federal',
      '237': 'Bradesco',
      '341': 'Itaú',
      '356': 'Banco Real',
      '389': 'Banco Mercantil do Brasil',
      '399': 'HSBC',
      '422': 'Safra',
      '453': 'Banco Rural',
      '633': 'Rendimento',
      '652': 'Itaú Unibanco',
      '745': 'Citibank',
      'CONV': 'Concessionária/Arrecadação'
    };
    return bankMap[code] || `Banco ${code}`;
  }

  private extractConcessionariaDueDate(dateStr: string): string | undefined {
    if (!dateStr || dateStr === '00000000' || dateStr === '99999999' || dateStr === '0000000') {
      return undefined;
    }

    // Tentar diferentes formatos de data comuns em boletos de concessionárias
    
    // Formato 1: AAAAMMDD (8 dígitos)
    if (dateStr.length === 8) {
      const year = parseInt(dateStr.substring(0, 4));
      const month = parseInt(dateStr.substring(4, 6));
      const day = parseInt(dateStr.substring(6, 8));
      
      if (year >= 1900 && year <= 2100 && month >= 1 && month <= 12 && day >= 1 && day <= 31) {
        const date = new Date(year, month - 1, day);
        if (!isNaN(date.getTime())) {
          return date.toISOString();
        }
      }
    }
    
    // Formato 2: DDMMYYYY (8 dígitos) - comum em alguns boletos
    if (dateStr.length === 8) {
      const day = parseInt(dateStr.substring(0, 2));
      const month = parseInt(dateStr.substring(2, 4));
      const year = parseInt(dateStr.substring(4, 8));
      
      if (year >= 1900 && year <= 2100 && month >= 1 && month <= 12 && day >= 1 && day <= 31) {
        const date = new Date(year, month - 1, day);
        if (!isNaN(date.getTime())) {
          return date.toISOString();
        }
      }
    }
    
    // Formato 3: YYMMDD (6 dígitos) com século 20 ou 21
    if (dateStr.length === 6) {
      const yearShort = parseInt(dateStr.substring(0, 2));
      const month = parseInt(dateStr.substring(2, 4));
      const day = parseInt(dateStr.substring(4, 6));
      
      // Determinar século: se ano < 50, assume 2000+, senão 1900+
      const year = yearShort < 50 ? 2000 + yearShort : 1900 + yearShort;
      
      if (year >= 1900 && year <= 2100 && month >= 1 && month <= 12 && day >= 1 && day <= 31) {
        const date = new Date(year, month - 1, day);
        if (!isNaN(date.getTime())) {
          return date.toISOString();
        }
      }
    }
    
    // Formato 4: DDMMYY (6 dígitos)
    if (dateStr.length === 6) {
      const day = parseInt(dateStr.substring(0, 2));
      const month = parseInt(dateStr.substring(2, 4));
      const yearShort = parseInt(dateStr.substring(4, 6));
      
      const year = yearShort < 50 ? 2000 + yearShort : 1900 + yearShort;
      
      if (year >= 1900 && year <= 2100 && month >= 1 && month <= 12 && day >= 1 && day <= 31) {
        const date = new Date(year, month - 1, day);
        if (!isNaN(date.getTime())) {
          return date.toISOString();
        }
      }
    }
    
    // Caso especial: 7 dígitos (como no exemplo da SABESP: "09111099")
    // Pode ser "DDMMYYX" onde X é dígito verificador ou "0DDMMYY"
    if (dateStr.length === 7) {
      // Tentativa 1: "0DDMMYY" (zero no início)
      if (dateStr.startsWith('0')) {
        const day = parseInt(dateStr.substring(1, 3));
        const month = parseInt(dateStr.substring(3, 5));
        const yearShort = parseInt(dateStr.substring(5, 7));
        
        const year = yearShort < 50 ? 2000 + yearShort : 1900 + yearShort;
        
        if (year >= 1900 && year <= 2100 && month >= 1 && month <= 12 && day >= 1 && day <= 31) {
          const date = new Date(year, month - 1, day);
          if (!isNaN(date.getTime())) {
            return date.toISOString();
          }
        }
      }
      
      // Tentativa 2: "DDMMYYX" (dígito extra no final)
      const day = parseInt(dateStr.substring(0, 2));
      const month = parseInt(dateStr.substring(2, 4));
      const yearShort = parseInt(dateStr.substring(4, 6));
      
      const year = yearShort < 50 ? 2000 + yearShort : 1900 + yearShort;
      
      if (year >= 1900 && year <= 2100 && month >= 1 && month <= 12 && day >= 1 && day <= 31) {
        const date = new Date(year, month - 1, day);
        if (!isNaN(date.getTime())) {
          return date.toISOString();
        }
      }
    }
    
    // Caso especial para SABESP: "09111099" pode ser "10/11/1999" 
    // Interpretação: "09 11 10 99" onde:
    // - "09" = dia 9 (ou 09 com zero à esquerda)
    // - "11" = mês 11
    // - "10" = ano 2010? ou 1910?
    // - "99" = dígito extra ou parte do ano
    
    // Tentar como "DDMMYYXX" onde XX são dígitos extras
    if (dateStr.length === 8) {
      // Remover possíveis zeros no início
      const cleanStr = dateStr.replace(/^0+/, '');
      if (cleanStr.length === 7) {
        // Agora "9111099" - tentar como DDMMYYX
        const day = parseInt(cleanStr.substring(0, 2));
        const month = parseInt(cleanStr.substring(2, 4));
        const yearShort = parseInt(cleanStr.substring(4, 6));
        const year = yearShort < 50 ? 2000 + yearShort : 1900 + yearShort;
        
        if (year >= 1900 && year <= 2100 && month >= 1 && month <= 12 && day >= 1 && day <= 31) {
          const date = new Date(year, month - 1, day);
          if (!isNaN(date.getTime())) {
            return date.toISOString();
          }
        }
      }
    }
    
    // Última tentativa: se nada funcionou, retornar undefined
    return undefined;
  }

  private getConcessionariaName(digits: string): string {
    // Segmento (posição 3-4 do código de barras)
    if (digits.length >= 4) {
      const segment = digits.substring(2, 4);
      const segmentMap: Record<string, string> = {
        '01': 'Prefeituras',
        '02': 'Saneamento',
        '03': 'Energia Elétrica e Gás',
        '04': 'Telecomunicações',
        '05': 'Órgãos Governamentais',
        '06': 'Carnes e Assemelhados',
        '07': 'Multas de trânsito',
        '08': 'Uso exclusivo do banco',
        '09': 'Uso exclusivo do banco',
        '10': 'Uso exclusivo do banco',
        '11': 'Uso exclusivo do banco',
        '12': 'Carteiras de investimento',
        '13': 'Outros',
        '98': 'Uso exclusivo do banco'
      };
      
      const segmentName = segmentMap[segment];
      if (segmentName) {
        return segmentName;
      }
    }
    
    // Identificação do valor (posição 4-5)
    if (digits.length >= 5) {
      const idValor = digits.substring(3, 5);
      if (idValor === '17') {
        return 'Arrecadação Pré‑Paga';
      }
    }
    
    return 'Concessionária de Serviços';
  }
}
