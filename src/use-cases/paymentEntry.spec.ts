import { expect, describe, it, beforeEach } from 'vitest'
import { PaymentEntryUseCase } from './paymentEntry'
import { InMemoryPaymentEntrysRepository } from '@/repositories/in-memory/in-memory-payment-entrys-repository'
import { InMemoryPaymentsRepository } from '@/repositories/in-memory/in-memory-payments-repository'
import { InMemoryTreatmentsRepository } from '@/repositories/in-memory/in-memory-treatments-repository'
import { InMemoryAccountsRepository } from '@/repositories/in-memory/in-memory-accounts-repository'
import { ResourceNotFoundError } from './errors/resource-not-found-error'
import { OnlyNaturalNumbersError } from './errors/only-natural-numbers-error'



let paymentEntrysRepository: InMemoryPaymentEntrysRepository
let paymentsRepository: InMemoryPaymentsRepository
let treatmentsRepository: InMemoryTreatmentsRepository
let accountsRepository: InMemoryAccountsRepository
let paymentEntryUseCase: PaymentEntryUseCase

describe('PaymentEntry Use Case', () => {
    beforeEach(() => {
        paymentEntrysRepository = new InMemoryPaymentEntrysRepository()
        paymentsRepository = new InMemoryPaymentsRepository()
        treatmentsRepository = new InMemoryTreatmentsRepository()
        accountsRepository = new InMemoryAccountsRepository
        paymentEntryUseCase = new PaymentEntryUseCase(paymentEntrysRepository, paymentsRepository, treatmentsRepository)
    })
    it('should be able to create an paymentEntry', async () => {
        const account = await accountsRepository.create({
            name: 'carteira',
            balance: 0
        })
        const treatment = await treatmentsRepository.create({
            opening_date: new Date(),
            request: 'Servidor travando',
            user_id: 'user.id'
        })
        const payment = await paymentsRepository.create({
            name: 'Dinheiro',
            installment_limit: 1,
            in_sight: true,
            account_id: account.id
        })
        const { paymentEntry } = await paymentEntryUseCase.execute({
            payment_id: payment.id,
            treatment_id: treatment.id,
            occurrences: 1,
            amount: 100
        })

        expect(paymentEntry.id).toEqual(expect.any(String))
    })
    it('should not be able to create an paymentEntry with a invalid payment', async () => {
        const treatment = await treatmentsRepository.create({
            opening_date: new Date(),
            request: 'Servidor travando',
            user_id: 'user.id'
        })
        await expect(paymentEntryUseCase.execute({
            payment_id: 'payment.id',
            treatment_id: treatment.id,
            occurrences: 1,
            amount: 100
        })).rejects.toBeInstanceOf(ResourceNotFoundError)
    })
    it('should not be able to create an paymentEntry with a invalid treatment', async () => {
        const account = await accountsRepository.create({
            name: 'carteira',
            balance: 0
        })
        const payment = await paymentsRepository.create({
            name: 'Dinheiro',
            installment_limit: 1,
            in_sight: true,
            account_id: account.id
        })
        await expect(paymentEntryUseCase.execute({
            payment_id: payment.id,
            treatment_id: 'treatment.id',
            occurrences: 1,
            amount: 100
        })).rejects.toBeInstanceOf(ResourceNotFoundError)
    })
    it('should not be able to create an paymentEntry with ocurrency igual or less than 0', async () => {
        const account = await accountsRepository.create({
            name: 'carteira',
            balance: 0
        })
        const treatment = await treatmentsRepository.create({
            opening_date: new Date(),
            request: 'Servidor travando',
            user_id: 'user.id'
        })
        const payment = await paymentsRepository.create({
            name: 'Dinheiro',
            installment_limit: 1,
            in_sight: true,
            account_id: account.id
        })
        await expect(paymentEntryUseCase.execute({
            payment_id: payment.id,
            treatment_id: treatment.id,
            occurrences: 0,
            amount: 100
        })).rejects.toBeInstanceOf(OnlyNaturalNumbersError)
    })
    it('should not be able to create an paymentEntry with amount igual or less than 0', async () => {
        const account = await accountsRepository.create({
            name: 'carteira',
            balance: 0
        })
        const treatment = await treatmentsRepository.create({
            opening_date: new Date(),
            request: 'Servidor travando',
            user_id: 'user.id'
        })
        const payment = await paymentsRepository.create({
            name: 'Dinheiro',
            installment_limit: 1,
            in_sight: true,
            account_id: account.id
        })
        await expect(paymentEntryUseCase.execute({
            payment_id: payment.id,
            treatment_id: treatment.id,
            occurrences: 1,
            amount: 0
        })).rejects.toBeInstanceOf(OnlyNaturalNumbersError)
    })
})

