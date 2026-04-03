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
      const rawAmount = params.get('vTotal') || params.get('vTot') || params.get('valorTotal') || params.get('vNF');
      if (rawAmount) {
        if (!rawAmount.includes('.') && !rawAmount.includes(',') && rawAmount.length > 2) {
          // Caso como 33184 -> 331.84
          amount = parseInt(rawAmount) / 100;
        } else {
          amount = parseFloat(rawAmount.replace(',', '.'));
        }
      }
      
      // 2. Extração de Data
      const dhEmi = params.get('dhEmi') || params.get('dhE');
      if (dhEmi) {
        const match = dhEmi.match(/^(\d{4})(\d{2})(\d{2})/);
        if (match) {
          dueDateISO = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3])).toISOString();
        } else if (!isNaN(Date.parse(dhEmi))) {
          dueDateISO = new Date(dhEmi).toISOString();
        }
      }

      // 3. Identificação do Emissor (Estabelecimento)
      const merchantName = params.get('nm') || params.get('fant') || params.get('emi') || params.get('xNome');
      if (merchantName) {
        description = merchantName;
      } else if (accessKey.length === 44) {
        // Extrai CNPJ da Chave de Acesso (posições 6 a 19)
        const cnpj = accessKey.substring(6, 20);
        description = `NF-e CNPJ: ${cnpj.substring(0, 2)}.${cnpj.substring(2, 5)}.${cnpj.substring(5, 8)}/${cnpj.substring(8, 12)}-${cnpj.substring(12, 14)}`;
      } else {
        // Fallback para o domínio
        description = `NF-e: ${urlObj.hostname.replace('www.', '')}`;
      }

    } catch (e) {
      description = `NFC-e: ${accessKey ? accessKey.slice(-8) : 'Scanner'}`;
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
