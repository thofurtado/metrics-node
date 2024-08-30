import { TransactionsRepository } from '@/repositories/transactions-repository'
import { ResourceNotFoundError } from './errors/resource-not-found-error'

interface DeleteTransactionUseCaseRequest {
    id: string
}
export class DeleteTransactionUseCase {

    constructor(
        private transactionsRepository: TransactionsRepository
    ) { }
    async execute({
        id
    }: DeleteTransactionUseCaseRequest): Promise<void> {

        const transaction = await this.transactionsRepository.findById(id)
        if (!transaction) {
            throw new ResourceNotFoundError()
        } else {

            await this.transactionsRepository.delete(id)
        }
    }
}

