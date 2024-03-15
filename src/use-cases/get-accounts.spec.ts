import { expect, describe, it, beforeEach } from 'vitest'
import { InMemoryAccountsRepository } from '@/repositories/in-memory/in-memory-accounts-repository'
import { GetAccountsUseCase } from './get-accounts'



let accountsRepository: InMemoryAccountsRepository
let getAccountsUseCase: GetAccountsUseCase


describe('Get Accounts Use Case', () => {
    beforeEach(() => {
        accountsRepository = new InMemoryAccountsRepository()
        getAccountsUseCase = new GetAccountsUseCase(accountsRepository)
    })
    it('should be able to get accounts', async () => {

        await accountsRepository.create({
            name: 'test1',
            balance: 0
        })
        await accountsRepository.create({
            name: 'test2',
            balance: 0
        })
        await accountsRepository.create({
            name: 'test3',
            balance: 0
        })
        await accountsRepository.create({
            name: 'test4',
            balance: 0
        })

        const { accounts } = await getAccountsUseCase.execute()

        expect(accounts?.length).toEqual(4)
    })

})
