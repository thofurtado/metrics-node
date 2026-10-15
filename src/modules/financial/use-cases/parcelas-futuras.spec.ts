import { describe, it, expect, vi, beforeEach } from 'vitest'

// Fase 1 do Mergulho (13:D3 e 13:D9): encerrar contrato e "excluir esta e as seguintes".
const banco = vi.hoisted(() => ({
    grupo: null as any,
    transacoes: [] as any[],
    apagadasEmLote: [] as string[],
    grupoAtualizado: null as any,
}))

vi.mock('@/lib/prisma', () => {
    const tx = {
        transaction: {
            deleteMany: async ({ where }: any) => {
                const ids = where.id.in.filter((id: string) => banco.transacoes.find(t => t.id === id && t.confirmed === where.confirmed))
                banco.apagadasEmLote.push(...ids)
                return { count: ids.length }
            },
        },
        transactionGroup: { update: async ({ data }: any) => { banco.grupoAtualizado = data } },
    }
    return {
        prisma: {
            transactionGroup: { findUnique: async () => banco.grupo },
            transaction: {
                findUnique: async ({ where }: any) => banco.transacoes.find(t => t.id === where.id) ?? null,
                findMany: async ({ where }: any) => banco.transacoes.filter(t =>
                    t.transaction_group_id === where.transaction_group_id &&
                    t.data_vencimento.getTime() >= where.data_vencimento.gte.getTime()),
            },
            $transaction: async (fn: any) => fn(tx),
        },
    }
})

import { TerminateTransactionGroupUseCase } from './terminate-transaction-group'
import { DeleteFutureTransactionsUseCase } from './delete-future-transactions-use-case'

const parcela = (n: number, confirmed: boolean) => ({
    id: `p${n}`, transaction_group_id: 'g1', amount: 100, confirmed, cashier_session_id: null,
    data_vencimento: new Date(2026, n - 1, 10),
})

describe('Encerrar contrato (13:D3)', () => {
    beforeEach(() => {
        banco.transacoes = [parcela(1, true), parcela(2, false), parcela(3, true), parcela(4, false), parcela(5, false)]
        banco.grupo = { id: 'g1', transactions: banco.transacoes }
        banco.apagadasEmLote = []
        banco.grupoAtualizado = null
    })

    it('apaga as parcelas em aberto depois da última mantida e mantém as pagas', async () => {
        const r = await new TerminateTransactionGroupUseCase({} as any).execute({ groupId: 'g1', lastKeptTransactionId: 'p2' })
        expect(banco.apagadasEmLote.sort()).toEqual(['p4', 'p5'])
        expect(r).toEqual({ apagadas: 2, pagasMantidas: 1 })
        expect(banco.grupoAtualizado).toEqual({ installmentsCount: 3, totalAmount: 300 })
    })
})

describe('Excluir esta e as seguintes (13:D9)', () => {
    let apagadas: string[]
    const repo: any = { delete: async (id: string) => { apagadas.push(id) } }

    beforeEach(() => {
        banco.transacoes = [parcela(1, true), parcela(2, false), parcela(3, true), parcela(4, false)]
        apagadas = []
    })

    it('não apaga a parcela já paga (antes, o valor dela voltava para o saldo da conta)', async () => {
        const r = await new DeleteFutureTransactionsUseCase(repo).execute({ transactionId: 'p2' })
        expect(apagadas).toEqual(['p2', 'p4'])
        expect(r).toEqual({ apagadas: 2, pagasMantidas: 1 })
    })

    it('avisa quando não sobra nenhuma parcela em aberto', async () => {
        banco.transacoes = [parcela(1, true), parcela(2, true)]
        await expect(new DeleteFutureTransactionsUseCase(repo).execute({ transactionId: 'p1' })).rejects.toThrow(/parcelas pagas não são apagadas/)
        expect(apagadas).toEqual([])
    })

    it('lançamento avulso já pago é recusado, como no apagar comum', async () => {
        banco.transacoes = [{ ...parcela(1, true), transaction_group_id: null }]
        await expect(new DeleteFutureTransactionsUseCase(repo).execute({ transactionId: 'p1' })).rejects.toThrow()
        expect(apagadas).toEqual([])
    })
})
