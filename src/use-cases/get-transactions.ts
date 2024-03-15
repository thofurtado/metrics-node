import { TransactionsRepository } from '@/repositories/transactions-repository'
import { Transaction } from '@prisma/client'


interface GetTransactionsUseCaseResponse {
    transactions: Transaction[] | null
}
export class GetTransactionsUseCase {

    constructor(
        private transactionsRepository: TransactionsRepository
    ) { }
    async execute(): Promise<GetTransactionsUseCaseResponse> {

        const transactions = await this.transactionsRepository.findMany()
        return {transactions}

    }
}

