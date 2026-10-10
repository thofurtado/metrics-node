import { describe, expect, it } from 'vitest'
import { PREFIXO_CONTA, baixaDaConta, contaComoRecebivel, criadasParaVencerEm, janelaDasContasDoMes, vencimentoDaConta } from './conta-do-cliente'

const criadaEm = new Date(2026, 9, 10, 9, 30) // 10/10/2026 09:30

describe('conta do cliente na lista "Clientes a Prazo" (10/10/2026)', () => {
    it('vira um recebível com o cliente junto e o id marcado', () => {
        const r = contaComoRecebivel({
            id: 'abc', client_id: 'c1', amount: 42.5, description: 'Venda a Prazo - Pedido #1f9408ee (Maria)', created_at: criadaEm,
            client: { id: 'c1', name: 'Maria' },
        })
        expect(r.id).toBe(`${PREFIXO_CONTA}abc`)
        expect(r).toMatchObject({ amount: 42.5, totalValue: 42.5, payment_method: 'A PRAZO', isClientTab: true, clientId: 'c1' })
        expect(r.client).toEqual({ id: 'c1', name: 'Maria' })
        expect(r.data_emissao).toEqual(criadaEm)
    })

    it('vence em 30 dias, como a receita a prazo da conferência', () => {
        expect(vencimentoDaConta(criadaEm)).toEqual(new Date(2026, 10, 9, 9, 30))
    })

    it('conta sem texto ganha um nome', () => {
        expect(contaComoRecebivel({ id: 'x', client_id: 'c', amount: 1, description: null, created_at: criadaEm }).description).toBe('Venda a Prazo')
    })
})

describe('baixaDaConta', () => {
    it('baixa inteira: recebe a conta toda', () => {
        expect(baixaDaConta(42.5, null, true)).toEqual({ recebido: 42.5, saldo: 0 })
    })

    it('baixa parcial de uma conta: recebe o pago e o resto fica devendo', () => {
        expect(baixaDaConta(42.5, 20, true)).toEqual({ recebido: 20, saldo: 22.5 })
        expect(baixaDaConta(0.3, 0.1, true)).toEqual({ recebido: 0.1, saldo: 0.2 })
    })

    it('várias contas de uma vez: sempre inteiras', () => {
        expect(baixaDaConta(42.5, 20, false)).toEqual({ recebido: 42.5, saldo: 0 })
    })

    it('pagou mais que a conta: recebe só a conta', () => {
        expect(baixaDaConta(42.5, 50, true)).toEqual({ recebido: 42.5, saldo: 0 })
    })
})

describe('criadasParaVencerEm', () => {
    it('vence em outubro = criada de 01/09 a 30/09 (30 dias antes)', () => {
        expect(criadasParaVencerEm({ gte: new Date(2026, 9, 1), lt: new Date(2026, 10, 1) }))
            .toEqual({ gte: new Date(2026, 8, 1), lt: new Date(2026, 9, 2) })
    })

    it('vencida hoje = criada há mais de 30 dias', () => {
        expect(criadasParaVencerEm({ lt: new Date(2026, 9, 10) })).toEqual({ lt: new Date(2026, 8, 10) })
    })
})

describe('janelaDasContasDoMes', () => {
    it('outubro: contas criadas no mês ou vencendo nele (criadas até 30 dias antes)', () => {
        const { desde, ate } = janelaDasContasDoMes(10, 2026)
        expect(desde).toEqual(new Date(2026, 8, 1, 0, 0, 0, 0)) // 01/09
        expect(ate).toEqual(new Date(2026, 9, 31, 23, 59, 59, 999))
    })
})
