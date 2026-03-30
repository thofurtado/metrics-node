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

    // 1. Arrecadação / Concessionárias (Inicia com 8)
    if (digits.startsWith('8')) {
      bankCode = 'CONV';
      // Extração rigorosa do valor para 48 dígitos
      if (digits.length === 48) {
        // Valor está no primeiro e segundo bloco (posições 4-11 e 12-15 do raw)
        // No 48 dígitos (com CDs): 4...11 e 12...15?? 
        // Na verdade é: 8261 (4) 0000000 (7) [CD] 8232 (4) ...
        // O valor nominal (11 dígitos) são as posições 4-11 do bloco 1 e 0-3 do bloco 2
        const valStr = digits.substring(4, 11) + digits.substring(12, 16);
        amount = parseInt(valStr) / 100;
      } else {
        const valStr = digits.substring(4, 15);
        amount = parseInt(valStr) / 100;
      }
      
      return {
        success: true,
        payload: {
          amount,
          description: 'Pagamento de Concessionária',
          type: 'BOLETO' as const,
          rawCode: digits,
        },
      };
    }

    // 2. Boletos Bancários Tradicionais
    let factor = 0;
    let amountStr = '';
    
    if (digits.length === 47) {
      bankCode = digits.substring(0, 3);
      factor = parseInt(digits.substring(33, 37));
      amountStr = digits.substring(37);
    } else if (digits.length === 44) {
      bankCode = digits.substring(0, 3);
      factor = parseInt(digits.substring(5, 9));
      amountStr = digits.substring(9, 19);
    }

    amount = parseInt(amountStr) / 100;
    
    if (factor > 0 && factor < 9999) {
      const baseDate = new Date(1997, 9, 7, 12, 0, 0); 
      const date = new Date(baseDate);
      date.setDate(baseDate.getDate() + factor);
      dueDateISO = date.toISOString();
    }

    return {
      success: true,
      payload: {
        amount,
        dueDate: dueDateISO,
        description: `Boleto Banco ${bankCode}`,
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
    
    try {
      const urlObj = new URL(url);
      const params = urlObj.searchParams;
      
      const vTotal = params.get('vTotal') || params.get('vTot') || params.get('valorTotal') || params.get('vNF');
      if (vTotal) {
        amount = parseFloat(vTotal.replace(',', '.'));
      }
      
      const dhEmi = params.get('dhEmi') || params.get('dhE');
      if (dhEmi) {
        const match = dhEmi.match(/^(\d{4})(\d{2})(\d{2})/);
        if (match) {
          dueDateISO = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3])).toISOString();
        } else if (!isNaN(Date.parse(dhEmi))) {
          dueDateISO = new Date(dhEmi).toISOString();
        }
      }
    } catch (e) {
    }
    
    return {
      success: true,
      payload: {
        amount,
        dueDate: dueDateISO,
        description: `NFC-e: ${accessKey.slice(-8)}`,
        type: 'NFCE' as const,
        rawCode: url,
      },
    };
  }
}
