import { expect, describe, it, beforeEach, vi } from 'vitest'
import { FinishTreatmentUseCase } from '@/modules/treatments/use-cases/finish-treatment'
import { InMemoryTreatmentsRepository } from '@/modules/treatments/repositories/in-memory/in-memory-treatments-repository'
import { InMemoryPaymentEntrysRepository } from '@/modules/financial/repositories/in-memory/in-memory-payment-entrys-repository'
import { InMemoryItemsRepository } from '@/modules/items/repositories/in-memory/in-memory-items-repository'
import { InMemoryTransactionsRepository } from '@/modules/financial/repositories/in-memory/in-memory-transactions-repository'
import { InMemoryAccountsRepository } from '@/modules/financial/repositories/in-memory/in-memory-accounts-repository'
import { ResourceNotFoundError } from '@/errors/resource-not-found-error'

// Mock Prisma and the Transaction Client
const mockTx = {
    stock: {
        create: vi.fn()
    }
}

vi.mock('@/lib/prisma', () => ({
    prisma: {
        $transaction: async (cb: any) => {
            return cb(mockTx)
        }
    }
}))

let treatmentsRepository: InMemoryTreatmentsRepository
let paymentEntrysRepository: InMemoryPaymentEntrysRepository
let itemsRepository: InMemoryItemsRepository
let transactionsRepository: InMemoryTransactionsRepository
let accountsRepository: InMemoryAccountsRepository
let sut: FinishTreatmentUseCase

describe('Finish Treatment Use Case', () => {
    beforeEach(() => {
        treatmentsRepository = new InMemoryTreatmentsRepository()
        paymentEntrysRepository = new InMemoryPaymentEntrysRepository()
        itemsRepository = new InMemoryItemsRepository()
        transactionsRepository = new InMemoryTransactionsRepository()
        accountsRepository = new InMemoryAccountsRepository()

        sut = new FinishTreatmentUseCase(
            treatmentsRepository,
            paymentEntrysRepository,
            itemsRepository,
            transactionsRepository,
            accountsRepository
        )

        mockTx.stock.create.mockClear()
    })

    it('should be able to finish a treatment normally (No Contract)', async () => {
        // 1. Create Data
        const item = await itemsRepository.create({
            name: 'SSD 240GB',
            price: 100,
            cost: 50,
            stock: 10,
            min_stock: 2,
            active: true,
            isItem: true,
            display_id: 1,
        })

        const treatment = await treatmentsRepository.create({
            status: 'pending',
            amount: 100,
            opening_date: new Date(),
            request: 'Format',
        })

        // Mock relations
        const t: any = treatmentsRepository.items.find(t => t.id === treatment.id)
        if (t) {
            t.clients = { contract: false }
            t.items = [{
                item_id: item.id,
                quantity: 1,
                items: { isItem: true }
            }]
        }

        // Payment
        const account = await accountsRepository.create({
            name: 'Caixa',
            balance: 0,
        })

        const paymentEntry = await paymentEntrysRepository.create({
            amount: 100,
            treatment_id: treatment.id,
            occurrences: 1,
            payment_id: 'pid',
        })

        // Mock Payment Entry Relation
        const pe: any = paymentEntrysRepository.items.find(p => p.id === paymentEntry.id)
        if (pe) {
            pe.payments = {
                id: 'pid',
                account_id: account.id,
                name: 'Dinheiro',
                in_sight: true /* Mocking the payment method object itself */
            }
        }

        // Execute
        const response = await sut.execute({ treatment_id: treatment.id })

        expect(response.treatment.status).toBe('resolved')

        // Check Stock Decrement
        const updatedItem = await itemsRepository.findById(item.id)
        expect(updatedItem?.stock).toBe(9)

        // Check Transaction Created
        const txs: any = (<any>transactionsRepository).items
        expect(txs).toHaveLength(1)
        expect(txs[0].amount).toBe(100)
    })

    it('should be able to finish a CONTRACT treatment with 0 balance', async () => {
        // 1. Create Data
        const item = await itemsRepository.create({
            name: 'Mão de Obra',
            price: 100,
            cost: 0,
            stock: 0,
            min_stock: 0,
            active: true,
            isItem: false, // Service
            display_id: 2,
        })

        const treatment = await treatmentsRepository.create({
            status: 'pending',
            amount: 0, // Contract covers it
            opening_date: new Date(),
            request: 'Format via Contract',
        })

        const t: any = treatmentsRepository.items.find(t => t.id === treatment.id)
        if (t) {
            t.clients = { contract: true }
            t.items = [{
                item_id: item.id,
                quantity: 1,
                items: { isItem: false }
            }]
        }

        // Execute
        const response = await sut.execute({ treatment_id: treatment.id })

        expect(response.treatment.status).toBe('resolved')

        // Check No Transaction Created
        const txs: any = (<any>transactionsRepository).items
        expect(txs).toHaveLength(0)
    })

    it('should be able to finish a CONTRACT treatment with Parts charged separately', async () => {
        // Contract covers Labor (0), but Client pays for SSD (100)

        const ssd = await itemsRepository.create({
            name: 'SSD',
            price: 100,
            cost: 50,
            stock: 5,
            min_stock: 0,
            active: true,
            isItem: true,
            display_id: 3,
        })

        const treatment = await treatmentsRepository.create({
            status: 'pending',
            amount: 100, // Only paying for SSD
            opening_date: new Date(),
            request: 'Contract + SSD',
        })

        const t: any = treatmentsRepository.items.find(t => t.id === treatment.id)
        if (t) {
            t.clients = { contract: true }
            t.items = [
                {
                    item_id: ssd.id,
                    quantity: 1,
                    items: { isItem: true }
                }
            ]
        }

        // Payment for the SSD
        const account = await accountsRepository.create({
            name: 'Banco',
            balance: 0,
        })

        const paymentEntry = await paymentEntrysRepository.create({
            amount: 100,
            treatment_id: treatment.id,
            occurrences: 1,
            payment_id: 'pid2'
        })

        // Mock Payment Relation
        const pe: any = paymentEntrysRepository.items.find(p => p.id === paymentEntry.id)
        if (pe) {
            pe.payments = {
                id: 'pid2',
                account_id: account.id,
                name: 'Pix',
                in_sight: true
            }
        }

        // Execute
        const response = await sut.execute({ treatment_id: treatment.id })

        expect(response.treatment.status).toBe('resolved')

        // Stock Decremented
        const updatedSSD = await itemsRepository.findById(ssd.id)
        expect(updatedSSD?.stock).toBe(4)

        // Transaction Created for the 100
        const txs: any = (<any>transactionsRepository).items
        expect(txs).toHaveLength(1)
        expect(txs[0].amount).toBe(100)
    })

    it('should block finish if amount > 0 and no payment (Normally)', async () => {
        const treatment = await treatmentsRepository.create({
            status: 'pending',
            amount: 500,
            opening_date: new Date(),
            request: 'Expensive',
        })

        const t: any = treatmentsRepository.items.find(t => t.id === treatment.id)
        if (t) {
            t.clients = { contract: false }
        }

        await expect(sut.execute({ treatment_id: treatment.id }))
            .rejects.toThrow('Pagamento insuficiente')
    })

    it('should block finish if amount > 0 and no payment (Contract with Parts)', async () => {
        // Contract client buys part but doesn't pay
        const treatment = await treatmentsRepository.create({
            status: 'pending',
            amount: 150,
            opening_date: new Date(),
            request: 'Parts Unpaid',
        })

        const t: any = treatmentsRepository.items.find(t => t.id === treatment.id)
        if (t) {
            t.clients = { contract: true }
        }

        await expect(sut.execute({ treatment_id: treatment.id }))
            .rejects.toThrow('Pagamento insuficiente')
    })
})
