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
      return this.handleBoleto(digitsOnly);
    }

    throw new Error('Formato de código não reconhecido.');
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
      const value = code.substring(i + 4, i + 4 + length);

      if (tag === '54') {
        payload.amount = parseFloat(value) || 0;
      } else if (tag === '59') {
        payload.description = value;
      } else if (tag === '62') {
        // Tenta pegar o campo 05 (Reference Label) se a descrição 59 estiver vazia
        if (!payload.description && value.includes('05')) {
           const subLength = parseInt(value.substring(2, 4));
           payload.description = value.substring(4, 4 + subLength);
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
    if (digits.startsWith('8') && (digits.length === 48 || digits.length === 44)) {
      bankCode = 'CONV';
      // No padrão de arrecadação, o valor está entre as posições 5 e 15 (raw)
      // Ajuste básico para o formato digitável de 48 posições
      if (digits.length === 48) {
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
    
    if (digits.length === 47 || digits.length === 48) {
      bankCode = digits.substring(0, 3);
      factor = parseInt(digits.substring(33, 37));
      amountStr = digits.substring(37);
    } else if (digits.length === 44) {
      bankCode = digits.substring(0, 3);
      factor = parseInt(digits.substring(5, 9));
      amountStr = digits.substring(9, 19);
    }

    amount = parseInt(amountStr) / 100;
    
    if (factor > 0) {
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
      
      // 1. Extração de Valor (suporta vários aliases comuns da SEFAZ)
      const vTotal = params.get('vTotal') || params.get('vTot') || params.get('valorTotal') || params.get('vNF');
      if (vTotal) {
        // Trata vírgula como ponto antes de converter
        amount = parseFloat(vTotal.replace(',', '.'));
      }
      
      // 2. Extração de Data de Emissão (dhEmi ou similar)
      const dhEmi = params.get('dhEmi') || params.get('dhE');
      if (dhEmi) {
        // dhEmi costuma vir em formato AAAAMMDDHHMMSS ou ISO
        const match = dhEmi.match(/^(\d{4})(\d{2})(\d{2})/);
        if (match) {
          dueDateISO = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3])).toISOString();
        } else if (!isNaN(Date.parse(dhEmi))) {
          dueDateISO = new Date(dhEmi).toISOString();
        }
      }
    } catch (e) {
      // Ignora erro de parsing de URL
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
