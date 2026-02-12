// factories/make-get-financial-summary.ts
import { PrismaTransactionsRepository } from '@/modules/financial/repositories/prisma/prisma-transactions-repository'
import { GetFinancialSummaryUseCase } from '@/modules/financial/use-cases/get-financial-summary'

export function MakeGetFinancialSummaryUseCase() {
    const transactionsRepository = new PrismaTransactionsRepository()
    const getFinancialSummaryUseCase = new GetFinancialSummaryUseCase(transactionsRepository)
    return getFinancialSummaryUseCase
}