// use-cases/get-financial-summary.ts
import { FinancialSummaryData } from '@/repositories/DTO/get-financial-dashboard-dto'
import { TransactionsRepository } from '@/repositories/transactions-repository'

interface GetFinancialSummaryUseCaseResponse {
    summary: FinancialSummaryData
}

export class GetFinancialSummaryUseCase {
    constructor(
        private transactionsRepository: TransactionsRepository
    ) { }

    async execute(): Promise<GetFinancialSummaryUseCaseResponse> {
        const summary = await this.transactionsRepository.getFinancialSummary()

        return { summary }
    }
}