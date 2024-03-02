import {expect, describe, it,beforeEach} from 'vitest'
import { AccountUseCase } from './account'



import { InMemoryAccountsRepository } from '@/repositories/in-memory/in-memory-accounts-repository'
import { ThisNameAlreadyExistsError } from './errors/this-name-already-exists-error'
import { NoNegativeValuesAllowedError } from './errors/no-negative-values-allowed-error'



let accountsRepository: InMemoryAccountsRepository
let accountUseCase: AccountUseCase

describe('Account Use Case', () => {
    beforeEach(() => {
        accountsRepository = new InMemoryAccountsRepository()
        accountUseCase = new AccountUseCase(accountsRepository)
    })
    it('should be able to create account', async () => {

        const {account} = await accountUseCase.execute({
            name: 'Carteira',
            description: 'Dinheiro físico',
            goal: 200,
            balance: 0
        })

        expect(account.id).toEqual(expect.any(String))
    })
    it('should not be able to create an account with the same name as other one', async () => {
        await accountUseCase.execute({
            name: 'Carteira',
            description: 'Dinheiro físico',
            goal: 200,
            balance: 0
        })
        await expect(accountUseCase.execute({
            name: 'Carteira',
            description: 'Dinheiro físico',
            goal: 200,
            balance: 0
        })).rejects.toBeInstanceOf(ThisNameAlreadyExistsError)
    })
    it('should not be able to create an account with a negative balance', async () => {
        await expect(accountUseCase.execute({
            name: 'Carteira',
            description: 'Dinheiro físico',
            goal: 200,
            balance: -1
        })).rejects.toBeInstanceOf(NoNegativeValuesAllowedError)
    })

})
