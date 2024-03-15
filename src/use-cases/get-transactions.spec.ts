import { expect, describe, it, beforeEach } from 'vitest'
import { InMemoryTransactionsRepository } from '@/repositories/in-memory/in-memory-transactions-repository'
import { GetTransactionsUseCase } from './get-transactions'



let transactionsRepository: InMemoryTransactionsRepository
let getTransactionsUseCase: GetTransactionsUseCase


describe('Get Transactions Use Case', () => {
    beforeEach(() => {
        transactionsRepository = new InMemoryTransactionsRepository()
        getTransactionsUseCase = new GetTransactionsUseCase(transactionsRepository)
    })
    it('should be able to get transactions', async () => {
        await transactionsRepository.create({
            operation: 'income',
            amount: 50,
            account_id: 'account-1',
            date: new Date(),
            sector_id: 'sector-empresa',
            description: 'Visita minima',
            confirmed: true
        })
        await transactionsRepository.create({
            operation: 'income',
            amount: 50,
            account_id: 'account-1',
            date: new Date(),
            sector_id: 'sector-empresa',
            description: 'Visita minima',
            confirmed: true
        })

        const { transactions } = await getTransactionsUseCase.execute()

        expect(transactions?.length).toEqual(2)
    })

})
