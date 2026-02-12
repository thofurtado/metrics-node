import { PaymentsRepository } from '@/modules/financial/repositories/payments-repository'
import { ResourceNotFoundError } from '@/errors/resource-not-found-error'

interface DeletePaymentUseCaseRequest {
    id: string
}

export class DeletePaymentUseCase {
    constructor(private paymentsRepository: PaymentsRepository) { }

    async execute({ id }: DeletePaymentUseCaseRequest): Promise<void> {
        const payment = await this.paymentsRepository.findById(id)

        if (!payment) {
            throw new ResourceNotFoundError()
        }

        await this.paymentsRepository.delete(id)
    }
}
