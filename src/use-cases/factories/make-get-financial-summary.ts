// factories/make-get-financial-summary.ts
import { PrismaTransactionsRepository } from '@/repositories/prisma/prisma-transactions-repository'
import { GetFinancialSummaryUseCase } from '../get-financial-summary'

export function MakeGetFinancialSummaryUseCase() {
    const transactionsRepository = new PrismaTransactionsRepository()
    const getFinancialSummaryUseCase = new GetFinancialSummaryUseCase(transactionsRepository)
    return getFinancialSummaryUseCase
}