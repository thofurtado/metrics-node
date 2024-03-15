import { expect, describe, it, beforeEach } from 'vitest'
import { PaymentUseCase } from './payment'
import { InMemoryPaymentsRepository } from '@/repositories/in-memory/in-memory-payments-repository'
import { InMemoryAccountsRepository } from '@/repositories/in-memory/in-memory-accounts-repository'
import { ThisNameAlreadyExistsError } from './errors/this-name-already-exists-error'
import { OnlyNaturalNumbersError } from './errors/only-natural-numbers-error'
import { ResourceNotFoundError } from './errors/resource-not-found-error'



let paymentsRepository: InMemoryPaymentsRepository
let accountsRepository: InMemoryAccountsRepository

let paymentUseCase: PaymentUseCase

describe('Payment Use Case', () => {
    beforeEach(() => {
        paymentsRepository = new InMemoryPaymentsRepository()
        accountsRepository = new InMemoryAccountsRepository()
        paymentUseCase = new PaymentUseCase(paymentsRepository, accountsRepository)
    })
    it('should be able to create an payment', async () => {
        const account = await accountsRepository.create({
            name: 'Carteira',
            description: 'Dinheiro físico',
            goal: 200,
            balance: 0
        })
        const { payment } = await paymentUseCase.execute({
            name: 'Mouse Usb 2.0 Multilaser',
            installment_limit: 2,
            in_sight: false,
            account_id: account.id
        })

        expect(payment.id).toEqual(expect.any(String))
    })
    it('should not be able to create a payment with invalid account', async () => {
        await expect( paymentUseCase.execute({
            name: 'Mouse Usb 2.0 Multilaser',
            installment_limit: 2,
            in_sight: false,
            account_id: 'account.id'
        })).rejects.toBeInstanceOf(ResourceNotFoundError)
    })
    it('should not be able to create a payment with negative installments', async () => {
        const account = await accountsRepository.create({
            name: 'Carteira',
            description: 'Dinheiro físico',
            goal: 200,
            balance: 0
        })
        await expect( paymentUseCase.execute({
            name: 'Mouse Usb 2.0 Multilaser',
            installment_limit: 0,
            in_sight: false,
            account_id: account.id
        })).rejects.toBeInstanceOf(OnlyNaturalNumbersError)
    })
    it('should not be able to create a payment with the same name', async () => {
        const account = await accountsRepository.create({
            name: 'Carteira',
            description: 'Dinheiro físico',
            goal: 200,
            balance: 0
        })
        await paymentUseCase.execute({
            name: 'Mouse Usb 2.0 Multilaser',
            installment_limit: 1,
            in_sight: false,
            account_id: account.id
        })
        await expect( paymentUseCase.execute({
            name: 'Mouse Usb 2.0 Multilaser',
            installment_limit: 2,
            in_sight: false,
            account_id: account.id
        })).rejects.toBeInstanceOf(ThisNameAlreadyExistsError)
    })
})

