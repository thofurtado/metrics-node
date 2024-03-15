import { expect, describe, it, beforeEach } from 'vitest'
import { TransferTransactionUseCase } from './transferTransaction'
import { InMemoryAccountsRepository } from '@/repositories/in-memory/in-memory-accounts-repository'
import { ResourceNotFoundError } from './errors/resource-not-found-error'
import { InMemoryTransferTransactionsRepository } from '@/repositories/in-memory/in-memory-transfer-transactions-repository'
import { InMemoryTransactionsRepository } from '@/repositories/in-memory/in-memory-transactions-repository'



let transferTransactionsRepository: InMemoryTransferTransactionsRepository
let accountsRepository: InMemoryAccountsRepository
let transactionsRepository: InMemoryTransactionsRepository
let transferTransactionUseCase: TransferTransactionUseCase


describe('Treatment Use Case', () => {
    beforeEach(() => {
        accountsRepository = new InMemoryAccountsRepository()
        transferTransactionsRepository = new InMemoryTransferTransactionsRepository()
        transactionsRepository = new InMemoryTransactionsRepository()

        transferTransactionUseCase = new TransferTransactionUseCase(transferTransactionsRepository, transactionsRepository, accountsRepository)
    })
    it('should be able to create transferTransaction', async () => {
        const account = await accountsRepository.create({
            name:'Carteira',
            balance: 0
        })
        const transaction = await transactionsRepository.create({
            operation: 'income',
            amount: 50,
            account_id: account.id,
            date: new Date(),
            sector_id: 'sector-1',
            description: 'Visita minima',
            confirmed: true
        })
        const  transferTransaction  = await transferTransactionUseCase.execute({
            destination_account_id: account.id,
            transaction_id: transaction.id
        })

        expect(transferTransaction.transferTransactions.id).toEqual(expect.any(String))

    })
    it('should not be able to create transferTransaction with an invalid account', async () => {

        const transaction = await transactionsRepository.create({
            operation: 'income',
            amount: 50,
            account_id: 'account.id',
            date: new Date(),
            sector_id: 'sector-1',
            description: 'Visita minima',
            confirmed: true
        })
        expect(transferTransactionUseCase.execute({
            destination_account_id: 'account.id',
            transaction_id: transaction.id
        })).rejects.toBeInstanceOf(ResourceNotFoundError)

    })
    it('should not be able to create transferTransaction with an invalid transaction', async () => {
        const account = await accountsRepository.create({
            name:'Carteira',
            balance: 0
        })

        expect(transferTransactionUseCase.execute({
            destination_account_id: account.id,
            transaction_id: 'transaction.id'
        })).rejects.toBeInstanceOf(ResourceNotFoundError)

    })


})
