import { expect, describe, it, beforeEach } from 'vitest'
import { InMemoryPaymentsRepository } from '@/repositories/in-memory/in-memory-payments-repository'
import { GetPaymentsUseCase } from './get-payments'
import { InMemoryAccountsRepository } from '@/repositories/in-memory/in-memory-accounts-repository'



let paymentsRepository: InMemoryPaymentsRepository
let getPaymentsUseCase: GetPaymentsUseCase
let accountsRepository: InMemoryAccountsRepository

describe('Get Payments Use Case', () => {
    beforeEach(() => {
        paymentsRepository = new InMemoryPaymentsRepository()
        accountsRepository = new InMemoryAccountsRepository()
        getPaymentsUseCase = new GetPaymentsUseCase(paymentsRepository)
    })
    it('should be able to get payments', async () => {
        const account = await accountsRepository.create({
            name: 'teste',
            balance: 100
        })
        await paymentsRepository.create({
            name: 'Dinheiro',
            account_id: account.id,
            installment_limit: 1,
            in_sight: true
        })
        await paymentsRepository.create({
            name: 'Debito',
            account_id: account.id,
            installment_limit: 1,
            in_sight: true
        })
        await paymentsRepository.create({
            name: 'Credito',
            account_id: account.id,
            installment_limit: 10,
            in_sight: false
        })


        const { payments } = await getPaymentsUseCase.execute()

        expect(payments?.length).toEqual(3)
    })

})
