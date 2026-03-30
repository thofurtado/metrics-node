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
      const tag = code.substring(i, i + 2);
      if (i + 4 > code.length) break;
      const length = parseInt(code.substring(i + 2, i + 4));
      const value = code.substring(i + 4, i + 4 + length);

      if (tag === '54') {
        payload.amount = parseFloat(value) || 0;
      } else if (tag === '59') {
        payload.description = value;
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
    let bankCode = '';
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

    const amount = parseInt(amountStr) / 100;
    
    let dueDateISO: string | undefined;
    if (factor > 0) {
      // Base date: 1997-10-07
      const baseDate = new Date(1997, 9, 7, 12, 0, 0); // 12:00 to avoid timezone issues
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
    
    // Tenta extrair o valor total da URL (muitos estados incluem vTotal ou valorTotal)
    let amount = 0;
    try {
      const urlObj = new URL(url);
      const vTotal = urlObj.searchParams.get('vTotal') || urlObj.searchParams.get('valorTotal');
      if (vTotal) {
        amount = parseFloat(vTotal.replace(',', '.'));
      }
    } catch (e) {
      // Ignora erro de parsing de URL
    }
    
    return {
      success: true,
      payload: {
        amount,
        description: `NFC-e: ${accessKey.substring(accessKey.length - 8)}`,
        type: 'NFCE' as const,
        rawCode: url,
      },
    };
  }
}
