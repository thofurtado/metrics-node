import { describe, it, expect, beforeEach, vi } from 'vitest'
import { InMemoryAccountsRepository } from '@/modules/financial/repositories/in-memory/in-memory-accounts-repository'
import { InMemoryProductsRepository } from '@/modules/items/repositories/in-memory/in-memory-products-repository'
import { InMemorySuppliesRepository } from '@/modules/items/repositories/in-memory/in-memory-supplies-repository'
import { ResourceNotFoundError } from '@/errors/resource-not-found-error'
import { ReopenTreatmentUseCase } from './reopen-treatment'

// ReopenTreatmentUseCase só entra no caminho transacional (prisma.$transaction) quando o repositório
// de treatments injetado NÃO é reconhecido como "InMemory" — por isso um fake proposital aqui, para
// exercitar de verdade o estorno financeiro e a restauração de estoque via `tx`.
class FakeTreatmentsRepository {
    constructor(public treatment: any) {}
    async findById(_id: string) {
        return this.treatment
    }
    async update(_id: string, data: any) {
        Object.assign(this.treatment, data)
        return this.treatment
    }
}

let deletedTransactionIds: string[] = []
let updatedTreatmentData: any = null
let links: any[] = []
let tabs: any[] = []
let deletedTabIds: string[] = []
let tabFilter: any = null

vi.mock('@/lib/prisma', () => ({
    prisma: {
        $transaction: async (cb: any) => cb({
            treatmentTransaction: {
                findMany: async () => links,
            },
            transaction: {
                delete: async ({ where }: any) => {
                    deletedTransactionIds.push(where.id)
                },
            },
            treatment: {
                update: async ({ data }: any) => {
                    updatedTreatmentData = data
                    return { id: 't1', ...data }
                },
            },
            stock: {
                create: async () => ({}),
            },
            clientTab: {
                findMany: async ({ where }: any) => {
                    tabFilter = where
                    return tabs
                },
                deleteMany: async ({ where }: any) => {
                    deletedTabIds.push(...where.id.in)
                },
            },
        }),
    },
}))

let accountsRepository: InMemoryAccountsRepository
let productsRepository: InMemoryProductsRepository
let suppliesRepository: InMemorySuppliesRepository

beforeEach(() => {
    deletedTransactionIds = []
    updatedTreatmentData = null
    links = []
    tabs = []
    deletedTabIds = []
    tabFilter = null
    accountsRepository = new InMemoryAccountsRepository()
    productsRepository = new InMemoryProductsRepository()
    suppliesRepository = new InMemorySuppliesRepository()
})

describe('Reopen Treatment Use Case', () => {
    it('recusa reabrir atendimento que não está finalizado', async () => {
        const treatmentsRepository = new FakeTreatmentsRepository({ id: 't1', status: 'pending', items: [] })
        const sut = new ReopenTreatmentUseCase(treatmentsRepository as any, accountsRepository, productsRepository, suppliesRepository)

        await expect(sut.execute({ treatment_id: 't1' })).rejects.toThrow('não está finalizado')
    })

    it('atendimento inexistente', async () => {
        const treatmentsRepository = new FakeTreatmentsRepository(null)
        const sut = new ReopenTreatmentUseCase(treatmentsRepository as any, accountsRepository, productsRepository, suppliesRepository)

        await expect(sut.execute({ treatment_id: 'nope' })).rejects.toBeInstanceOf(ResourceNotFoundError)
    })

    it('estorna a transação confirmada (devolve totalValue à conta) e apaga o registro', async () => {
        const account = await accountsRepository.create({ name: 'Caixa', balance: 500 } as any)
        links = [{
            transaction: {
                id: 'tx-1',
                operation: 'income',
                amount: 100,
                totalValue: 110, // recebido com juro
                confirmed: true,
                account_id: account.id,
            },
        }]

        const treatmentsRepository = new FakeTreatmentsRepository({ id: 't1', status: 'resolved', items: [] })
        const sut = new ReopenTreatmentUseCase(treatmentsRepository as any, accountsRepository, productsRepository, suppliesRepository)

        const { treatment } = await sut.execute({ treatment_id: 't1' })

        expect(account.balance).toBe(390) // devolveu os 110 recebidos (não só o principal)
        expect(deletedTransactionIds).toEqual(['tx-1'])
        expect(treatment.status).toBe('pending')
        expect(updatedTreatmentData).toMatchObject({ status: 'pending', ending_date: null })
    })

    it('não mexe no saldo de uma parcela que ainda estava pendente (nunca chegou a afetar a conta)', async () => {
        const account = await accountsRepository.create({ name: 'Caixa', balance: 500 } as any)
        links = [{
            transaction: { id: 'tx-2', operation: 'income', amount: 50, totalValue: null, confirmed: false, account_id: account.id },
        }]

        const treatmentsRepository = new FakeTreatmentsRepository({ id: 't1', status: 'resolved', items: [] })
        const sut = new ReopenTreatmentUseCase(treatmentsRepository as any, accountsRepository, productsRepository, suppliesRepository)

        await sut.execute({ treatment_id: 't1' })

        expect(account.balance).toBe(500)
        expect(deletedTransactionIds).toEqual(['tx-2'])
    })

    it('devolve ao estoque um produto simples e um insumo direto baixados no fechamento', async () => {
        const product = await productsRepository.create({ name: 'SSD', price: 100, stock: 4 } as any)
        const supply = await suppliesRepository.create({ name: 'Copo descartável', stock: 20 } as any)

        const treatmentsRepository = new FakeTreatmentsRepository({
            id: 't1',
            status: 'resolved',
            items: [
                { product_id: product.id, quantity: 1, product: { id: product.id, is_composite: false } },
                { supply_id: supply.id, quantity: 3 },
            ],
        })
        const sut = new ReopenTreatmentUseCase(treatmentsRepository as any, accountsRepository, productsRepository, suppliesRepository)

        await sut.execute({ treatment_id: 't1' })

        expect((await productsRepository.findById(product.id))?.stock).toBe(5)
        expect((await suppliesRepository.findById(supply.id))?.stock).toBe(23)
    })

    it('devolve aos insumos de um produto composto exatamente o que a composição consumiu', async () => {
        const supplyA = await suppliesRepository.create({ name: 'Farinha', stock: 10 } as any)
        const supplyB = await suppliesRepository.create({ name: 'Queijo', stock: 10 } as any)

        const treatmentsRepository = new FakeTreatmentsRepository({
            id: 't1',
            status: 'resolved',
            items: [{
                product_id: 'prod-composto',
                quantity: 2, // 2 unidades vendidas
                product: {
                    id: 'prod-composto',
                    is_composite: true,
                    compositions: [
                        { supply_id: supplyA.id, quantity: 1 }, // 1 por unidade
                        { supply_id: supplyB.id, quantity: 0.5 },
                    ],
                },
            }],
        })
        const sut = new ReopenTreatmentUseCase(treatmentsRepository as any, accountsRepository, productsRepository, suppliesRepository)

        await sut.execute({ treatment_id: 't1' })

        expect((await suppliesRepository.findById(supplyA.id))?.stock).toBe(12) // +1*2
        expect((await suppliesRepository.findById(supplyB.id))?.stock).toBe(11) // +0.5*2
    })

    // Fase 1 do Mergulho (16:A3 e 16:A2)
    it('tira da conta do cliente o a prazo ainda aberto desta O.S.', async () => {
        tabs = [{ id: 'tab-1', is_paid: false }]
        const treatmentsRepository = new FakeTreatmentsRepository({ id: 'abcdef12-0000-0000-0000-000000000000', status: 'resolved', items: [] })
        const sut = new ReopenTreatmentUseCase(treatmentsRepository as any, accountsRepository, productsRepository, suppliesRepository)

        await sut.execute({ treatment_id: 'abcdef12-0000-0000-0000-000000000000' })

        expect(tabFilter).toEqual({ description: { contains: 'O.S #abcdef12' } })
        expect(deletedTabIds).toEqual(['tab-1'])
    })

    it('recusa reabrir quando o cliente já pagou parte do a prazo da O.S. (nada é desfeito)', async () => {
        const account = await accountsRepository.create({ name: 'Caixa', balance: 500 } as any)
        tabs = [{ id: 'tab-pago', is_paid: true }, { id: 'tab-saldo', is_paid: false }]
        links = [{ transaction: { id: 'tx-1', operation: 'income', amount: 100, totalValue: 100, confirmed: true, account_id: account.id } }]
        const treatmentsRepository = new FakeTreatmentsRepository({ id: 't1', status: 'resolved', items: [] })
        const sut = new ReopenTreatmentUseCase(treatmentsRepository as any, accountsRepository, productsRepository, suppliesRepository)

        await expect(sut.execute({ treatment_id: 't1' })).rejects.toThrow('já pagou')
        expect(deletedTabIds).toEqual([])
        expect(deletedTransactionIds).toEqual([])
        expect(account.balance).toBe(500)
    })

    it('cancelar uma O.S. finalizada usa a mesma reversão e já grava "canceled"', async () => {
        const treatmentsRepository = new FakeTreatmentsRepository({ id: 't1', status: 'resolved', items: [] })
        const sut = new ReopenTreatmentUseCase(treatmentsRepository as any, accountsRepository, productsRepository, suppliesRepository)

        const { treatment } = await sut.execute({ treatment_id: 't1', nextStatus: 'canceled' })

        expect(treatment.status).toBe('canceled')
        expect(updatedTreatmentData).toMatchObject({ status: 'canceled', ending_date: null })
    })
})
