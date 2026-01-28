import { expect, describe, it, beforeEach } from 'vitest'
import { DeleteTransactionUseCase } from './delete-transaction'
import { InMemoryTransactionsRepository } from '@/repositories/in-memory/in-memory-transactions-repository'
import { ResourceNotFoundError } from './errors/resource-not-found-error'

import { TransactionAlreadyConfirmedError } from './errors/transaction-already-confirmed-error'

let transactionsRepository: InMemoryTransactionsRepository
let sut: DeleteTransactionUseCase

describe('Delete Transaction Use Case', () => {
    beforeEach(() => {
        transactionsRepository = new InMemoryTransactionsRepository()
        sut = new DeleteTransactionUseCase(transactionsRepository)
    })

    it('should be able to delete a non-confirmed transaction', async () => {
        const transaction = await transactionsRepository.create({
            description: 'Venda pendente',
            amount: 100,
            operation: 'income',
            account_id: 'acc-1',
            confirmed: false,
            date: new Date()
        })

        await sut.execute({ id: transaction.id })

        const deletedTransaction = await transactionsRepository.findById(transaction.id)
        expect(deletedTransaction).toBeNull()
    })

    it('should not be able to delete a confirmed transaction', async () => {
        const transaction = await transactionsRepository.create({
            description: 'Venda finalizada',
            amount: 100,
            operation: 'income',
            account_id: 'acc-1',
            confirmed: true, // Confirmed!
            date: new Date()
        })

        await expect(sut.execute({ id: transaction.id }))
            .rejects.toBeInstanceOf(TransactionAlreadyConfirmedError)
    })

    it('should not be able to delete a non-existent transaction', async () => {
        await expect(sut.execute({ id: 'non-existent-id' })).rejects.toBeInstanceOf(ResourceNotFoundError)
    })
})
