import { InMemoryPaymentsRepository } from '@/repositories/in-memory/in-memory-payments-repository'
import { InMemoryAccountsRepository } from '@/repositories/in-memory/in-memory-accounts-repository'
import { UpdatePaymentUseCase } from './update-payment'
import { ResourceNotFoundError } from './errors/resource-not-found-error'
import { describe, beforeEach, it, expect } from 'vitest'

let paymentsRepository: InMemoryPaymentsRepository
let accountsRepository: InMemoryAccountsRepository
let sut: UpdatePaymentUseCase

describe('Update Payment Use Case', () => {
    beforeEach(() => {
        paymentsRepository = new InMemoryPaymentsRepository()
        accountsRepository = new InMemoryAccountsRepository()
        sut = new UpdatePaymentUseCase(paymentsRepository, accountsRepository)
    })

    it('should be able to update a payment', async () => {
        const payment = await paymentsRepository.create({
            name: 'Credit Card',
            installment_limit: 12,
            in_sight: false
        })

        const { payment: updatedPayment } = await sut.execute({
            id: payment.id,
            name: 'Debit Card',
        })

        expect(updatedPayment.name).toEqual('Debit Card')
    })

    it('should not be able to update a non-existing payment', async () => {
        await expect(() =>
            sut.execute({
                id: 'non-existing-id',
                name: 'New Name',
            })
        ).rejects.toBeInstanceOf(ResourceNotFoundError)
    })
})
