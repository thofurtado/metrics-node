import { describe, expect, it } from 'vitest'
import { motivoParaNaoRecalcular, saldoPelosLancamentos, ultimoAjusteManual } from './saldo-da-conta'

describe('saldo pelos lançamentos (Mergulho 13:D1)', () => {
    it('receita entra, despesa sai, com o valor total ou o valor', () => {
        expect(saldoPelosLancamentos([
            { operation: 'income', totalValue: 95, amount: 100 },
            { operation: 'expense', totalValue: null, amount: 30 },
        ])).toBe(65)
    })

    it('transferência de origem sai da conta', () => {
        // Katatau: a conta que mandou R$ 21.070,00 para outra
        expect(saldoPelosLancamentos([
            { operation: 'income', totalValue: 86481.36, amount: 86481.36 },
            { operation: 'expense', totalValue: 49321.03, amount: 49321.03 },
            { operation: 'transfer', totalValue: 21070, amount: 21070, cashier_session_id: null },
        ])).toBe(16090.33)
    })

    it('destino de caixa (transfer com caixa) entra na conta', () => {
        expect(saldoPelosLancamentos([
            { operation: 'transfer', totalValue: 50, amount: 50, cashier_session_id: 'caixa-1' },
        ])).toBe(50)
    })

    it('resumo do caixa e outras operações não entram', () => {
        expect(saldoPelosLancamentos([{ operation: 'cashier_summary', totalValue: 999, amount: 999 }])).toBe(0)
    })
})

describe('acerto manual trava o recálculo (Mergulho 13:D1)', () => {
    const recalculo = { description: 'Recálculo Automático de Saldo (Soma de Transações Confirmadas)', new_balance: 10, created_at: new Date('2026-10-09T12:00:00Z') }
    const zeragem = { description: 'Saldo zerado na limpeza do financeiro (08/10/2026, pedido do Thomás)', new_balance: 0, created_at: new Date('2026-10-08T14:00:38Z') }
    const manual = { description: 'Ajuste de Saldo Manual', new_balance: 3762, created_at: new Date('2026-08-04T12:02:15Z') }

    it('só recálculos automáticos: não trava', () => {
        expect(ultimoAjusteManual([recalculo])).toBeNull()
        expect(motivoParaNaoRecalcular(null)).toBeNull()
    })

    it('pega o acerto manual mais recente (zeragem conta como acerto)', () => {
        expect(ultimoAjusteManual([manual, recalculo, zeragem])).toBe(zeragem)
    })

    it('a mensagem diz quando e para quanto', () => {
        const msg = motivoParaNaoRecalcular(manual)!
        expect(msg).toContain('04/08/2026')
        expect(msg).toContain('3.762,00')
        expect(msg).toContain('Ajustar saldo')
    })
})
