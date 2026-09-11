import { describe, it, expect, beforeEach } from 'vitest'
import { PayCreditCardInvoiceUseCase } from './pay-credit-card-invoice'
import { ResourceNotFoundError } from '@/errors/resource-not-found-error'

// In-memory mock database for pristine, isolated test runs
function createMockPrisma() {
    let accounts: any[] = []
    let creditCards: any[] = []
    let transactions: any[] = []

    const mockPrisma: any = {
        account: {
            findUnique: async ({ where }: any) => accounts.find(a => a.id === where.id) || null,
            update: async ({ where, data }: any) => {
                const acc = accounts.find(a => a.id === where.id)
                if (!acc) throw new Error('Account not found')
                if (data.balance?.decrement) {
                    acc.balance = Number((acc.balance - data.balance.decrement).toFixed(2))
                }
                return acc
            }
        },
        creditCard: {
            findUnique: async ({ where }: any) => creditCards.find(c => c.id === where.id) || null
        },
        transaction: {
            findMany: async ({ where }: any) => {
                return transactions.filter(t => {
                    const tDate = new Date(t.data_vencimento)
                    if (where.credit_card_id && t.credit_card_id !== where.credit_card_id) return false
                    if (where.payment_method && t.payment_method !== where.payment_method) return false
                    if (where.confirmed !== undefined && t.confirmed !== where.confirmed) return false
                    if (where.data_vencimento?.gte && tDate < where.data_vencimento.gte) return false
                    if (where.data_vencimento?.lte && tDate > where.data_vencimento.lte) return false
                    return true
                }).sort((a, b) => new Date(a.data_vencimento).getTime() - new Date(b.data_vencimento).getTime())
            },
            update: async ({ where, data }: any) => {
                const tx = transactions.find(t => t.id === where.id)
                if (!tx) throw new Error('Transaction not found')
                Object.assign(tx, data)
                return tx
            },
            create: async ({ data }: any) => {
                const created = { id: `tx-${transactions.length + 1}`, ...data }
                transactions.push(created)
                return created
            }
        },
        $transaction: async (callback: any) => {
            return await callback(mockPrisma)
        },
        _seed: (data: { accounts?: any[], creditCards?: any[], transactions?: any[] }) => {
            accounts = data.accounts ? data.accounts.map(a => ({ ...a })) : []
            creditCards = data.creditCards ? data.creditCards.map(c => ({ ...c })) : []
            transactions = data.transactions ? data.transactions.map(t => ({ ...t, data_vencimento: new Date(t.data_vencimento) })) : []
        },
        _getTransactions: () => transactions,
        _getAccounts: () => accounts
    }

    return mockPrisma
}

describe('Pay Credit Card Invoice Use Case (Option B)', () => {
    let mockPrisma: any
    let sut: PayCreditCardInvoiceUseCase

    beforeEach(() => {
        mockPrisma = createMockPrisma()
        sut = new PayCreditCardInvoiceUseCase(mockPrisma)
    })

    it('should fully settle invoice and confirm all purchases preserving individual sectors', async () => {
        mockPrisma._seed({
            accounts: [
                { id: 'acc-1', name: 'Conta Principal', balance: 1000.00 }
            ],
            creditCards: [
                { id: 'card-1', name: 'Nubank', account_id: 'acc-1' }
            ],
            transactions: [
                {
                    id: 'tx-1',
                    credit_card_id: 'card-1',
                    payment_method: 'CREDIT_CARD',
                    operation: 'expense',
                    amount: 100.00,
                    totalValue: 100.00,
                    sector_id: 'sector-alimentacao',
                    confirmed: false,
                    description: 'Supermercado',
                    data_vencimento: new Date(2026, 8, 10)
                },
                {
                    id: 'tx-2',
                    credit_card_id: 'card-1',
                    payment_method: 'CREDIT_CARD',
                    operation: 'expense',
                    amount: 150.00,
                    totalValue: 150.00,
                    sector_id: 'sector-saude',
                    confirmed: false,
                    description: 'Farmacia',
                    data_vencimento: new Date(2026, 8, 10)
                },
                {
                    id: 'tx-3',
                    credit_card_id: 'card-1',
                    payment_method: 'CREDIT_CARD',
                    operation: 'expense',
                    amount: 50.00,
                    totalValue: 50.00,
                    sector_id: 'sector-transporte',
                    confirmed: false,
                    description: 'Combustivel',
                    data_vencimento: new Date(2026, 8, 10)
                }
            ]
        })

        const result = await sut.execute({
            creditCardId: 'card-1',
            month: '2026-09',
            amountPaid: 300.00,
            accountId: 'acc-1'
        })

        expect(result.paidAmount).toBe(300.00)
        expect(result.remainingAmount).toBe(0)
        expect(result.isFullyPaid).toBe(true)
        expect(result.confirmedCount).toBe(3)
        expect(result.splitOccurred).toBe(false)

        // Verifica que o saldo bancário foi debitado exatamente em 300
        const accounts = mockPrisma._getAccounts()
        expect(accounts[0].balance).toBe(700.00)

        // Verifica que todas as compras foram confirmadas mantendo os setores
        const allTx = mockPrisma._getTransactions()
        expect(allTx).toHaveLength(3) // Nenhuma despesa duplicada/lump-sum criada!
        expect(allTx[0].confirmed).toBe(true)
        expect(allTx[0].sector_id).toBe('sector-alimentacao')
        expect(allTx[0].account_id).toBe('acc-1')

        expect(allTx[1].confirmed).toBe(true)
        expect(allTx[1].sector_id).toBe('sector-saude')
        expect(allTx[1].account_id).toBe('acc-1')

        expect(allTx[2].confirmed).toBe(true)
        expect(allTx[2].sector_id).toBe('sector-transporte')
        expect(allTx[2].account_id).toBe('acc-1')
    })

    it('should partially settle invoice with split, preserving sector on both paid and remainder parts', async () => {
        mockPrisma._seed({
            accounts: [
                { id: 'acc-1', name: 'Conta Principal', balance: 500.00 }
            ],
            creditCards: [
                { id: 'card-1', name: 'Nubank', account_id: 'acc-1' }
            ],
            transactions: [
                {
                    id: 'tx-1',
                    credit_card_id: 'card-1',
                    payment_method: 'CREDIT_CARD',
                    operation: 'expense',
                    amount: 100.00,
                    totalValue: 100.00,
                    sector_id: 'sector-alimentacao',
                    confirmed: false,
                    description: 'Supermercado',
                    data_vencimento: new Date(2026, 8, 10),
                    data_emissao: new Date(2026, 8, 1)
                },
                {
                    id: 'tx-2',
                    credit_card_id: 'card-1',
                    payment_method: 'CREDIT_CARD',
                    operation: 'expense',
                    amount: 200.00,
                    totalValue: 200.00,
                    sector_id: 'sector-saude',
                    confirmed: false,
                    description: 'Exames Medicos',
                    data_vencimento: new Date(2026, 8, 10),
                    data_emissao: new Date(2026, 8, 2)
                },
                {
                    id: 'tx-3',
                    credit_card_id: 'card-1',
                    payment_method: 'CREDIT_CARD',
                    operation: 'expense',
                    amount: 50.00,
                    totalValue: 50.00,
                    sector_id: 'sector-combustivel',
                    confirmed: false,
                    description: 'Posto Gasolina',
                    data_vencimento: new Date(2026, 8, 10),
                    data_emissao: new Date(2026, 8, 3)
                }
            ]
        })

        // Fatura total: R$ 350. Pagamento parcial: R$ 150.
        const result = await sut.execute({
            creditCardId: 'card-1',
            month: '2026-09',
            amountPaid: 150.00,
            accountId: 'acc-1'
        })

        expect(result.paidAmount).toBe(150.00)
        expect(result.remainingAmount).toBe(200.00)
        expect(result.isFullyPaid).toBe(false)
        expect(result.confirmedCount).toBe(2)
        expect(result.splitOccurred).toBe(true)

        // Saldo bancário debitado em 150
        const accounts = mockPrisma._getAccounts()
        expect(accounts[0].balance).toBe(350.00)

        const allTx = mockPrisma._getTransactions()
        expect(allTx).toHaveLength(4) // tx-1, tx-2 (paga 50), tx-3 (pendente), tx-4 (restante de tx-2)

        // Compra 1 (R$ 100) 100% quitada no setor Alimentação
        const t1 = allTx.find(t => t.id === 'tx-1')
        expect(t1.confirmed).toBe(true)
        expect(t1.amount).toBe(100.00)
        expect(t1.sector_id).toBe('sector-alimentacao')

        // Compra 2 original: amortizou R$ 50, confirmada no setor Saúde
        const t2 = allTx.find(t => t.id === 'tx-2')
        expect(t2.confirmed).toBe(true)
        expect(t2.amount).toBe(50.00)
        expect(t2.sector_id).toBe('sector-saude')

        // Compra 2 desmembrada: restante de R$ 150 pendente no MESMO setor Saúde
        const remainder = allTx.find(t => t.parent_transaction_id === 'tx-2')
        expect(remainder).toBeDefined()
        expect(remainder.confirmed).toBe(false)
        expect(remainder.amount).toBe(150.00)
        expect(remainder.sector_id).toBe('sector-saude')
        expect(remainder.credit_card_id).toBe('card-1')
        expect(remainder.payment_method).toBe('CREDIT_CARD')

        // Compra 3 (R$ 50) continua 100% pendente no setor Combustível
        const t3 = allTx.find(t => t.id === 'tx-3')
        expect(t3.confirmed).toBe(false)
        expect(t3.amount).toBe(50.00)
        expect(t3.sector_id).toBe('sector-combustivel')
    })

    it('should support multiple consecutive partial payments until full settlement', async () => {
        mockPrisma._seed({
            accounts: [
                { id: 'acc-1', name: 'Conta Principal', balance: 1000.00 }
            ],
            creditCards: [
                { id: 'card-1', name: 'Nubank', account_id: 'acc-1' }
            ],
            transactions: [
                {
                    id: 'tx-1',
                    credit_card_id: 'card-1',
                    payment_method: 'CREDIT_CARD',
                    operation: 'expense',
                    amount: 200.00,
                    totalValue: 200.00,
                    sector_id: 'sector-compras',
                    confirmed: false,
                    data_vencimento: new Date(2026, 8, 10)
                }
            ]
        })

        // 1º Pagamento: R$ 50
        const res1 = await sut.execute({
            creditCardId: 'card-1',
            month: '2026-09',
            amountPaid: 50.00,
            accountId: 'acc-1'
        })
        expect(res1.paidAmount).toBe(50.00)
        expect(res1.remainingAmount).toBe(150.00)
        expect(res1.isFullyPaid).toBe(false)
        expect(mockPrisma._getAccounts()[0].balance).toBe(950.00)

        // 2º Pagamento: R$ 100
        const res2 = await sut.execute({
            creditCardId: 'card-1',
            month: '2026-09',
            amountPaid: 100.00,
            accountId: 'acc-1'
        })
        expect(res2.paidAmount).toBe(100.00)
        expect(res2.remainingAmount).toBe(50.00)
        expect(res2.isFullyPaid).toBe(false)
        expect(mockPrisma._getAccounts()[0].balance).toBe(850.00)

        // 3º Pagamento: R$ 50 (Quitação final)
        const res3 = await sut.execute({
            creditCardId: 'card-1',
            month: '2026-09',
            amountPaid: 50.00,
            accountId: 'acc-1'
        })
        expect(res3.paidAmount).toBe(50.00)
        expect(res3.remainingAmount).toBe(0)
        expect(res3.isFullyPaid).toBe(true)
        expect(mockPrisma._getAccounts()[0].balance).toBe(800.00)

        // Todas as transações desse cartão estão confirmadas
        const allTx = mockPrisma._getTransactions()
        expect(allTx.every((t: any) => t.confirmed)).toBe(true)
        const totalPaidSum = allTx.reduce((sum: number, t: any) => sum + t.amount, 0)
        expect(totalPaidSum).toBe(200.00)
    })

    it('should throw error when paying an amount greater than total pending balance', async () => {
        mockPrisma._seed({
            accounts: [{ id: 'acc-1', balance: 1000.00 }],
            creditCards: [{ id: 'card-1', account_id: 'acc-1' }],
            transactions: [
                {
                    id: 'tx-1',
                    credit_card_id: 'card-1',
                    payment_method: 'CREDIT_CARD',
                    amount: 100.00,
                    confirmed: false,
                    data_vencimento: new Date(2026, 8, 10)
                }
            ]
        })

        await expect(sut.execute({
            creditCardId: 'card-1',
            month: '2026-09',
            amountPaid: 150.00
        })).rejects.toThrow('excede o saldo devedor restante')
    })

    it('should throw error when paying an invoice with zero pending purchases', async () => {
        mockPrisma._seed({
            accounts: [{ id: 'acc-1', balance: 1000.00 }],
            creditCards: [{ id: 'card-1', account_id: 'acc-1' }],
            transactions: [
                {
                    id: 'tx-1',
                    credit_card_id: 'card-1',
                    payment_method: 'CREDIT_CARD',
                    amount: 100.00,
                    confirmed: true, // Já quitada
                    data_vencimento: new Date(2026, 8, 10)
                }
            ]
        })

        await expect(sut.execute({
            creditCardId: 'card-1',
            month: '2026-09',
            amountPaid: 100.00
        })).rejects.toThrow('Não há compras pendentes')
    })

    it('should isolate invoices from different months', async () => {
        mockPrisma._seed({
            accounts: [{ id: 'acc-1', balance: 1000.00 }],
            creditCards: [{ id: 'card-1', account_id: 'acc-1' }],
            transactions: [
                {
                    id: 'tx-sept',
                    credit_card_id: 'card-1',
                    payment_method: 'CREDIT_CARD',
                    amount: 100.00,
                    confirmed: false,
                    data_vencimento: new Date(2026, 8, 10) // Setembro
                },
                {
                    id: 'tx-oct',
                    credit_card_id: 'card-1',
                    payment_method: 'CREDIT_CARD',
                    amount: 200.00,
                    confirmed: false,
                    data_vencimento: new Date(2026, 9, 10) // Outubro
                }
            ]
        })

        // Quita apenas Setembro
        const result = await sut.execute({
            creditCardId: 'card-1',
            month: '2026-09',
            amountPaid: 100.00
        })

        expect(result.paidAmount).toBe(100.00)
        expect(result.isFullyPaid).toBe(true)

        const allTx = mockPrisma._getTransactions()
        const septTx = allTx.find(t => t.id === 'tx-sept')
        const octTx = allTx.find(t => t.id === 'tx-oct')

        expect(septTx.confirmed).toBe(true)
        expect(octTx.confirmed).toBe(false) // Outubro continua pendente!
    })

    it('should accurately preserve sectors for DRE / expense by sector reporting after partial settlement', async () => {
        mockPrisma._seed({
            accounts: [
                { id: 'acc-1', name: 'Conta Principal', balance: 1000.00 }
            ],
            creditCards: [
                { id: 'card-1', name: 'Nubank', account_id: 'acc-1' }
            ],
            transactions: [
                {
                    id: 'tx-1',
                    credit_card_id: 'card-1',
                    payment_method: 'CREDIT_CARD',
                    operation: 'expense',
                    amount: 100.00,
                    totalValue: 100.00,
                    sector_id: 'sector-alimentacao',
                    confirmed: false,
                    description: 'Almoço Equipe',
                    data_vencimento: new Date(2026, 8, 10)
                },
                {
                    id: 'tx-2',
                    credit_card_id: 'card-1',
                    payment_method: 'CREDIT_CARD',
                    operation: 'expense',
                    amount: 200.00,
                    totalValue: 200.00,
                    sector_id: 'sector-saude',
                    confirmed: false,
                    description: 'Plano Odonto',
                    data_vencimento: new Date(2026, 8, 10)
                }
            ]
        })

        // Antes do pagamento: DRE confirmado = R$ 0,00
        const getConfirmedBySector = () => {
            const confirmedTx = mockPrisma._getTransactions().filter((t: any) => t.confirmed)
            const map: Record<string, number> = {}
            for (const t of confirmedTx) {
                map[t.sector_id] = Number(((map[t.sector_id] || 0) + t.amount).toFixed(2))
            }
            return map
        }

        expect(getConfirmedBySector()).toEqual({})

        // Paga R$ 150 (R$ 100 de Alimentação + R$ 50 de Saúde)
        await sut.execute({
            creditCardId: 'card-1',
            month: '2026-09',
            amountPaid: 150.00,
            accountId: 'acc-1'
        })

        // Após pagamento parcial: DRE reflete exatamente os R$ 100 em Alimentação e R$ 50 em Saúde!
        const dre = getConfirmedBySector()
        expect(dre['sector-alimentacao']).toBe(100.00)
        expect(dre['sector-saude']).toBe(50.00)
        expect(dre['sector-alimentacao'] + dre['sector-saude']).toBe(150.00)
    })
})
