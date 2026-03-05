// use-cases/get-financial-summary.ts
import { FinancialSummaryData } from '@/modules/financial/repositories/DTO/get-financial-dashboard-dto'
import { TransactionsRepository } from '@/modules/financial/repositories/transactions-repository'

interface GetFinancialSummaryUseCaseResponse {
    summary: FinancialSummaryData
}

export class GetFinancialSummaryUseCase {
    constructor(
        private transactionsRepository: TransactionsRepository
    ) { }

    async execute(date?: Date): Promise<GetFinancialSummaryUseCaseResponse> {
        const summary = await this.transactionsRepository.getFinancialSummary(date)

        return { summary }
    }
}