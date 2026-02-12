import { expect, describe, it, beforeEach } from 'vitest'
import { ChangeTransactionUseCase } from '@/modules/financial/use-cases/change-transaction-status'
import { InMemoryTransactionsRepository } from '@/modules/financial/repositories/in-memory/in-memory-transactions-repository'
import { ResourceNotFoundError } from '@/errors/resource-not-found-error'
import { TransactionAlreadyConfirmedError } from '@/modules/financial/use-cases/transaction-already-confirmed-error'

let transactionsRepository: InMemoryTransactionsRepository
let sut: ChangeTransactionUseCase

describe('Change Transaction Status Use Case', () => {
    beforeEach(() => {
        transactionsRepository = new InMemoryTransactionsRepository()
        sut = new ChangeTransactionUseCase(transactionsRepository)
    })

    it('should be able to settle a transaction fully', async () => {
        const transaction = await transactionsRepository.create({
            description: 'Aluguel',
            amount: 1000,
            operation: 'expense',
            account_id: 'acc-1',
            confirmed: false,
            date: new Date('2024-01-01')
        })

        await sut.execute({
            id: transaction.id,
            amount: 1000,
            date: new Date('2024-01-05')
        })

        const updatedTransaction = await transactionsRepository.findById(transaction.id)

        expect(updatedTransaction?.confirmed).toBe(true)
        expect(updatedTransaction?.amount).toBe(1000)
        expect(updatedTransaction?.date).toEqual(new Date('2024-01-05'))
    })

    it('should be able to settle a transaction partially (Split)', async () => {
        const transaction = await transactionsRepository.create({
            description: 'Serviço',
            amount: 1000,
            operation: 'income',
            account_id: 'acc-1',
            confirmed: false,
            date: new Date('2024-01-01')
        })

        // Pay 400, Remaining 600
        await sut.execute({
            id: transaction.id,
            amount: 400,
            date: new Date('2024-01-05')
        })

        // Check Original Transaction
        const updatedOriginal = await transactionsRepository.findById(transaction.id)
        expect(updatedOriginal?.confirmed).toBe(true)
        expect(updatedOriginal?.amount).toBe(400) // Changed to paid amount

        // Check Remaining Transaction creation
        const allTransactions = transactionsRepository.items
        const remainingTransaction = allTransactions.find(t => t.id !== transaction.id)

        expect(remainingTransaction).toBeDefined()
        expect(remainingTransaction?.amount).toBe(600)
        expect(remainingTransaction?.confirmed).toBe(false)
        expect(remainingTransaction?.description).toBe('PR (1): Serviço')
        expect(remainingTransaction?.operation).toBe('income')
    })

    it('should correctly increment the partial payment level description', async () => {
        const transaction = await transactionsRepository.create({
            description: 'PR (1): Serviço',
            amount: 600,
            operation: 'income',
            account_id: 'acc-1',
            confirmed: false,
            date: new Date()
        })

        // Pay 200, Remaining 400
        await sut.execute({
            id: transaction.id,
            amount: 200,
            date: new Date()
        })

        const allTransactions = transactionsRepository.items
        const remainingTransaction = allTransactions.find(t => t.id !== transaction.id)

        expect(remainingTransaction?.description).toBe('PR (2): Serviço')
        expect(remainingTransaction?.amount).toBe(400)
    })

    it('should fallback description if original has none', async () => {
        const transaction = await transactionsRepository.create({
            description: null,
            amount: 100,
            operation: 'expense',
            account_id: 'acc-1',
            confirmed: false,
            date: new Date()
        })

        await sut.execute({
            id: transaction.id,
            amount: 50,
            date: new Date()
        })

        const allTransactions = transactionsRepository.items
        const remainingTransaction = allTransactions.find(t => t.id !== transaction.id)

        expect(remainingTransaction?.description).toBe('PR (1): Sem Descrição Original')
    })

    it('should not be able to settle a non-existent transaction', async () => {
        await expect(sut.execute({
            id: 'non-existent-id',
            amount: 100,
            date: new Date()
        })).rejects.toBeInstanceOf(ResourceNotFoundError)
    })

    it('should not be able to settle an already confirmed transaction', async () => {
        const transaction = await transactionsRepository.create({
            description: 'Aluguel',
            amount: 1000,
            operation: 'expense',
            account_id: 'acc-1',
            confirmed: true,
            date: new Date()
        })

        await expect(sut.execute({
            id: transaction.id,
            amount: 1000,
            date: new Date()
        })).rejects.toBeInstanceOf(TransactionAlreadyConfirmedError)
    })

    it('should not be able to settle with negative amount', async () => {
        const transaction = await transactionsRepository.create({
            description: 'Aluguel',
            amount: 1000,
            operation: 'expense',
            account_id: 'acc-1',
            confirmed: false,
            date: new Date()
        })

        await expect(sut.execute({
            id: transaction.id,
            amount: -100,
            date: new Date()
        })).rejects.toThrow('O valor de liquidação (amount) deve ser positivo.')
    })

    it('should not be able to pay more than the original amount', async () => {
        const transaction = await transactionsRepository.create({
            description: 'Aluguel',
            amount: 1000,
            operation: 'expense',
            account_id: 'acc-1',
            confirmed: false,
            date: new Date()
        })

        await expect(sut.execute({
            id: transaction.id,
            amount: 1001,
            date: new Date()
        })).rejects.toThrow(/não pode ser maior que o valor da transação original/)
    })
})
