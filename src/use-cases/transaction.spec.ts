import {expect, describe, it,beforeEach} from 'vitest'
import { TransactionUseCase } from './transaction'
import { InMemoryTransactionsRepository } from '@/repositories/in-memory/in-memory-transactions-repository'
import { ResourceNotFoundError } from './errors/resource-not-found-error'
import { InMemoryAccountsRepository } from '@/repositories/in-memory/in-memory-accounts-repository'
import { InMemoryTransferTransactionsRepository } from '@/repositories/in-memory/in-memory-transfer-transactions-repository'


let transactionsRepository: InMemoryTransactionsRepository
let accountsRepository: InMemoryAccountsRepository
let transferTransactionsRepository: InMemoryTransferTransactionsRepository
let transactionUseCase: TransactionUseCase


describe('Transaction Use Case', () => {
    beforeEach(() => {
        accountsRepository = new InMemoryAccountsRepository()
        transactionsRepository = new InMemoryTransactionsRepository()
        transferTransactionsRepository = new InMemoryTransferTransactionsRepository()
        transactionUseCase = new TransactionUseCase(transactionsRepository, transferTransactionsRepository, accountsRepository)
    })
    it('should be able to create transaction', async () => {

        const {transaction} = await transactionUseCase.execute({
            operation: 'income',
            amount: 50,
            account_id: 'account-1',
            date: new Date(),
            sector_id: 'sector-1',
            description: 'Visita minima',
            confirmed: true
        })
        expect(transaction.id).toEqual(expect.any(String))
    })
    it('should not be able to create transaction if the operation is rather than income or expense or transfer', async () => {

        await transactionUseCase.execute({
            operation: 'income',
            amount: 50,
            account_id: 'account-1',
            date: new Date(),
            sector_id: 'sector-empresa',
            description: 'Visita minima',
            confirmed: true
        })
        await transactionUseCase.execute({
            operation: 'expense',
            amount: 75,
            account_id: 'account-1',
            date: new Date(),
            sector_id: 'sector-transporte',
            description: 'Troca da camara do pneu',
            confirmed: true
        })


        await expect(transactionUseCase.execute({
            operation: 'entry',
            amount: 50,
            account_id: 'account-1',
            date: new Date(),
            description: 'Visita minima',
            confirmed: true
        })).rejects.toBeInstanceOf(ResourceNotFoundError)
    })
    it('should not be able change account balance if transition its not confirmed', async () => {
        const conta1 = await accountsRepository.create({
            name: 'conta-1',
            balance: 100
        })
        const conta2 = await accountsRepository.create({
            name: 'conta-1',
            balance: 30
        })
        await transactionUseCase.execute({
            operation: 'income',
            amount: 50,
            account_id: conta1.id,
            date: new Date(),
            sector_id: 'sector-empresa',
            description: 'Visita minima',
            confirmed: false
        })
        await transactionUseCase.execute({
            operation: 'expense',
            amount: 100,
            account_id: conta1.id,
            date: new Date(),
            sector_id: 'sector-empresa',
            description: 'Mercado',
            confirmed: false
        })

        expect(conta1).toHaveProperty('balance', 100)
        expect(conta2).toHaveProperty('balance', 30)
    })

    it('should be able to create a transfer transaction register when operation is transfer and alter balance in account', async () => {
        const conta1 = await accountsRepository.create({
            name: 'conta-1',
            balance: 100
        })
        const conta2 = await accountsRepository.create({
            name: 'conta-2',
            balance: 200
        })
        const transaction = await transactionUseCase.execute({
            operation: 'transfer',
            amount: 50,
            account_id: conta1.id,
            date: new Date(),
            sector_id: 'sector-transporte',
            confirmed: true,
            destination_account_id: conta2.id
        })


        expect(conta1).toHaveProperty('balance', 50)
        expect(conta2).toHaveProperty('balance', 250)
        expect(transaction.transaction.id).toEqual(expect.any(String))
    })
    it('should not be able to alter account balance in transfer if its not confirmed', async () => {
        const conta1 = await accountsRepository.create({
            name: 'conta-1',
            balance: 100
        })
        const conta2 = await accountsRepository.create({
            name: 'conta-2',
            balance: 200
        })
        const transaction = await transactionUseCase.execute({
            operation: 'transfer',
            amount: 50,
            account_id: conta1.id,
            date: new Date(),
            sector_id: 'sector-transporte',
            confirmed: false,
            destination_account_id: conta2.id
        })
        expect(conta1).toHaveProperty('balance', 100)
        expect(conta2).toHaveProperty('balance', 200)
        expect(transaction.transaction.id).toEqual(expect.any(String))
    })
})
