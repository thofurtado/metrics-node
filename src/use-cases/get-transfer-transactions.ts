import { TransferTransactionsRepository } from '@/repositories/transfer-transactions-repository'
import { TransferTransaction } from '@prisma/client'


interface GetTransferTransactionsUseCaseResponse {
    transferTransactions: TransferTransaction[] | null
}
export class GetTransferTransactionsUseCase {

    constructor(
        private transferTransactionsRepository: TransferTransactionsRepository
    ) { }
    async execute(): Promise<GetTransferTransactionsUseCaseResponse> {

        const transferTransactions = await this.transferTransactionsRepository.findMany()
        return {transferTransactions}

    }
}

