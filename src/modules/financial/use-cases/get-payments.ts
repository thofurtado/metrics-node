import { PaymentsRepository } from '@/modules/financial/repositories/payments-repository'

export class GetPaymentsUseCase {
    constructor(private paymentsRepository: PaymentsRepository) {}

    async execute() {
        const payments = await this.paymentsRepository.findMany()
        return { payments }
    }
}