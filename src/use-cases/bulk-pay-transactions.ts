
import { TransactionsRepository } from "@/repositories/transactions-repository"

interface BulkPayTransactionsRequest {
    transactionIds: string[]
}

export class BulkPayTransactionsUseCase {
    constructor(private transactionsRepository: TransactionsRepository) { }

    async execute({ transactionIds }: BulkPayTransactionsRequest): Promise<void> {
        if (!transactionIds.length) return

        await this.transactionsRepository.markAsPaidMany(transactionIds)
    }
}
