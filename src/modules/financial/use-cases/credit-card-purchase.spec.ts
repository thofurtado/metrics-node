import { describe, it, expect, beforeEach } from 'vitest'
import { UpdateCreditCardPurchaseUseCase } from './update-credit-card-purchase'
import { DeleteCreditCardPurchaseUseCase } from './delete-credit-card-purchase'

function createMockPrisma() {
    let accounts: any[] = []
    let creditCards: any[] = []
    let transactions: any[] = []
    let groups: any[] = []

    const mockPrisma: any = {
        account: {
            update: async ({ where, data }: any) => {
                const acc = accounts.find(a => a.id === where.id)
                if (data.balance?.decrement !== undefined) acc.balance = Number((acc.balance - data.balance.decrement).toFixed(2))
                if (data.balance?.increment !== undefined) acc.balance = Number((acc.balance + data.balance.increment).toFixed(2))
                return acc
            },
        },
        creditCard: { findUnique: async ({ where }: any) => creditCards.find(c => c.id === where.id) || null },
        holiday: { findMany: async () => [] },
        transaction: {
            findUnique: async ({ where }: any) => transactions.find(t => t.id === where.id) || null,
            findMany: async ({ where }: any) =>
                transactions.filter(t => {
                    if (where.transaction_group_id && t.transaction_group_id !== where.transaction_group_id) return false
                    if (where.payment_method && t.payment_method !== where.payment_method) return false
                    if (where.data_vencimento?.gte && new Date(t.data_vencimento) < where.data_vencimento.gte) return false
                    return true
                }),
            update: async ({ where, data }: any) => {
                const tx = transactions.find(t => t.id === where.id)
                Object.assign(tx, data)
                return tx
            },
            delete: async ({ where }: any) => {
                transactions = transactions.filter(t => t.id !== where.id)
            },
        },
        transactionGroup: {
            update: async ({ where, data }: any) => {
                const g = groups.find(x => x.id === where.id)
                if (data.totalAmount?.increment !== undefined) g.totalAmount = Number((g.totalAmount + data.totalAmount.increment).toFixed(2))
                else if (typeof data.totalAmount === 'number') g.totalAmount = data.totalAmount
                if (data.installmentsCount !== undefined) g.installmentsCount = data.installmentsCount
                return g
            },
            delete: async ({ where }: any) => {
                groups = groups.filter(g => g.id !== where.id)
            },
        },
        $transaction: async (cb: any) => cb(mockPrisma),
        _seed: (d: any) => {
            accounts = d.accounts ?? []
            creditCards = d.creditCards ?? []
            transactions = d.transactions ?? []
            groups = d.groups ?? []
        },
        _tx: () => transactions,
        _accounts: () => accounts,
        _groups: () => groups,
    }
    return mockPrisma
}

const card = { id: 'card-1', name: 'Nubank', closing_day: 10, due_day: 20, account_id: 'acc-1' }
const swipe = (over: any = {}) => ({
    id: 's1',
    operation: 'expense',
    amount: 100,
    totalValue: null,
    confirmed: false,
    payment_method: 'CREDIT_CARD',
    credit_card_id: 'card-1',
    account_id: 'acc-1',
    transaction_group_id: null,
    description: 'Compra',
    data_emissao: new Date(2026, 8, 5, 12),
    data_vencimento: new Date(2026, 8, 21, 12),
    ...over,
})

describe('UpdateCreditCardPurchaseUseCase', () => {
    let prisma: any
    let sut: UpdateCreditCardPurchaseUseCase

    beforeEach(() => {
        prisma = createMockPrisma()
        sut = new UpdateCreditCardPurchaseUseCase(prisma)
    })

    it('recalcula o vencimento ao mudar a data da compra (pendente)', async () => {
        prisma._seed({ accounts: [{ id: 'acc-1', balance: 500 }], creditCards: [card], transactions: [swipe()] })

        // fechamento dia 10, vencimento dia 20: compra dia 05/09 vence em setembro; dia 15/09 já fechou e vence em outubro
        const { transaction } = await sut.execute({ id: 's1', data_emissao: new Date(2026, 8, 15, 12) })

        expect(transaction.data_vencimento.getMonth()).toBe(9) // outubro
        expect(transaction.data_vencimento.getDate()).toBe(20)
        expect(prisma._accounts()[0].balance).toBe(500)
    })

    it('muda valor de compra pendente sem mexer no saldo e ajusta o total do parcelamento', async () => {
        prisma._seed({
            accounts: [{ id: 'acc-1', balance: 500 }],
            creditCards: [card],
            transactions: [swipe({ transaction_group_id: 'g1' })],
            groups: [{ id: 'g1', totalAmount: 300, installmentsCount: 3 }],
        })

        const { transaction } = await sut.execute({ id: 's1', amount: 130 })

        expect(transaction.amount).toBe(130)
        expect(transaction.totalValue).toBeNull()
        expect(prisma._accounts()[0].balance).toBe(500)
        expect(prisma._groups()[0].totalAmount).toBe(330)
    })

    it('em compra já paga, ajusta o saldo da conta pela diferença e grava totalValue', async () => {
        prisma._seed({
            accounts: [{ id: 'acc-1', balance: 400 }],
            creditCards: [card],
            transactions: [swipe({ confirmed: true, totalValue: null })],
        })

        const { transaction } = await sut.execute({ id: 's1', amount: 130 })

        expect(transaction.amount).toBe(130)
        expect(transaction.totalValue).toBe(130)
        expect(prisma._accounts()[0].balance).toBe(370) // pagou 30 a mais

        await sut.execute({ id: 's1', amount: 90 })
        expect(prisma._accounts()[0].balance).toBe(410) // 40 devolvidos
    })

    it('em compra já paga, bloqueia mudar data da compra e cartão', async () => {
        prisma._seed({ accounts: [{ id: 'acc-1', balance: 400 }], creditCards: [card], transactions: [swipe({ confirmed: true })] })

        await expect(sut.execute({ id: 's1', data_emissao: new Date(2026, 8, 20, 12) })).rejects.toThrow(/já paga/)
        await expect(sut.execute({ id: 's1', credit_card_id: 'card-2' })).rejects.toThrow(/já paga/)
    })

    it('recusa despesa que não é compra no cartão e compra inexistente', async () => {
        prisma._seed({ accounts: [], creditCards: [card], transactions: [swipe({ id: 'x', payment_method: 'PIX', credit_card_id: null })] })

        await expect(sut.execute({ id: 'x', amount: 10 })).rejects.toThrow(/não é uma compra/)
        await expect(sut.execute({ id: 'nope', amount: 10 })).rejects.toThrow(/não encontrada/)
    })
})

describe('DeleteCreditCardPurchaseUseCase', () => {
    let prisma: any
    let sut: DeleteCreditCardPurchaseUseCase

    const installments = () => [
        swipe({ id: 'p1', transaction_group_id: 'g1', confirmed: true, data_vencimento: new Date(2026, 8, 21, 12) }),
        swipe({ id: 'p2', transaction_group_id: 'g1', data_vencimento: new Date(2026, 9, 21, 12) }),
        swipe({ id: 'p3', transaction_group_id: 'g1', data_vencimento: new Date(2026, 10, 21, 12) }),
    ]

    beforeEach(() => {
        prisma = createMockPrisma()
        sut = new DeleteCreditCardPurchaseUseCase(prisma)
    })

    it('exclui só a parcela pendente e atualiza o grupo', async () => {
        prisma._seed({ accounts: [{ id: 'acc-1', balance: 400 }], transactions: installments(), groups: [{ id: 'g1', totalAmount: 300, installmentsCount: 3 }] })

        const res = await sut.execute({ id: 'p2', scope: 'one' })

        expect(res).toEqual({ deleted: 1, preserved: 0 })
        expect(prisma._tx().map((t: any) => t.id)).toEqual(['p1', 'p3'])
        expect(prisma._groups()[0]).toMatchObject({ installmentsCount: 2, totalAmount: 200 })
        expect(prisma._accounts()[0].balance).toBe(400)
    })

    it('excluir parcela já paga devolve o valor para a conta', async () => {
        prisma._seed({ accounts: [{ id: 'acc-1', balance: 400 }], transactions: installments(), groups: [{ id: 'g1', totalAmount: 300, installmentsCount: 3 }] })

        await sut.execute({ id: 'p1', scope: 'one' })

        expect(prisma._accounts()[0].balance).toBe(500)
    })

    it('"esta e seguintes" apaga pendentes a partir da clicada e preserva as pagas', async () => {
        prisma._seed({ accounts: [{ id: 'acc-1', balance: 400 }], transactions: installments(), groups: [{ id: 'g1', totalAmount: 300, installmentsCount: 3 }] })

        const res = await sut.execute({ id: 'p1', scope: 'forward' })

        expect(res).toEqual({ deleted: 2, preserved: 1 })
        expect(prisma._tx().map((t: any) => t.id)).toEqual(['p1'])
        expect(prisma._accounts()[0].balance).toBe(400)
        expect(prisma._groups()[0]).toMatchObject({ installmentsCount: 1, totalAmount: 100 })
    })

    it('"todas" apaga o parcelamento pendente e remove o grupo quando esvazia', async () => {
        prisma._seed({
            accounts: [{ id: 'acc-1', balance: 400 }],
            transactions: installments().map(t => ({ ...t, confirmed: false })),
            groups: [{ id: 'g1', totalAmount: 300, installmentsCount: 3 }],
        })

        const res = await sut.execute({ id: 'p2', scope: 'all' })

        expect(res).toEqual({ deleted: 3, preserved: 0 })
        expect(prisma._tx()).toHaveLength(0)
        expect(prisma._groups()).toHaveLength(0)
    })

    it('avisa quando tudo já foi pago', async () => {
        prisma._seed({ accounts: [{ id: 'acc-1', balance: 400 }], transactions: installments().map(t => ({ ...t, confirmed: true })), groups: [{ id: 'g1', totalAmount: 300, installmentsCount: 3 }] })

        await expect(sut.execute({ id: 'p1', scope: 'all' })).rejects.toThrow(/já foram pagas/)
    })
})
