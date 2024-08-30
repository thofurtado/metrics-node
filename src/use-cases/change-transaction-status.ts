import { TransactionsRepository } from '@/repositories/transactions-repository'



interface ChangeTransactionUseCaseRequest {
    id: string,
}

export class ChangeTransactionUseCase {
    constructor(
        private transactionsRepository: TransactionsRepository
    ) { }
    async execute({
        id,
    }: ChangeTransactionUseCaseRequest): Promise<void> {
        const findedTransaction = await this.transactionsRepository.findById(id)
        if (findedTransaction)
            await this.transactionsRepository.changeTransactionStatus(id)
    }
}

