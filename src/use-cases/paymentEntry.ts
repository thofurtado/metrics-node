import { PaymentEntrysRepository } from '@/repositories/paymentEntrys-repository'
import { PaymentEntry } from '@prisma/client'

import { OnlyNaturalNumbersError } from './errors/only-natural-numbers-error'
import { PaymentsRepository } from '@/repositories/payments-repository'
import { TreatmentsRepository } from '@/repositories/treatments-repository'
import { ResourceNotFoundError } from './errors/resource-not-found-error'

interface PaymentEntryUseCaseRequest {
    payment_id: string,
    treatment_id: string,
    occurrences: number,
    amount: number
}
interface PaymentEntryUseCaseResponse {
    paymentEntry: PaymentEntry
}
export class PaymentEntryUseCase {

    constructor(
        private paymentEntrysRepository: PaymentEntrysRepository,
        private paymentRepository: PaymentsRepository,
        private treatmentRepository: TreatmentsRepository
    ) { }
    async execute({
        payment_id, treatment_id, occurrences, amount
    }: PaymentEntryUseCaseRequest): Promise<PaymentEntryUseCaseResponse> {

        const payment = await this.paymentRepository.findById(payment_id)
        if (!payment)
            throw new ResourceNotFoundError()

        const treatment = await this.treatmentRepository.findById(treatment_id)

        if (!treatment)
            throw new ResourceNotFoundError()

        if(occurrences <= 0 || amount <= 0)
            throw new OnlyNaturalNumbersError()


        const paymentEntry = await this.paymentEntrysRepository.create({
            payment_id, treatment_id, occurrences, amount
        })
        return {
            paymentEntry
        }
    }
}

