import { PaymentsRepository } from '@/repositories/payments-repository'
import { Payment } from '@prisma/client'


interface GetPaymentsUseCaseResponse {
    payments: Payment[] | null
}
export class GetPaymentsUseCase {

    constructor(
        private paymentsRepository: PaymentsRepository
    ) { }
    async execute(): Promise<GetPaymentsUseCaseResponse> {

        const payments = await this.paymentsRepository.findMany()


        return {
            payments
        }
    }
}

