import { PrismaTransactionsRepository } from '@/modules/financial/repositories/prisma/prisma-transactions-repository'
import { GetMonthExpenseBySectorUseCase } from '@/modules/sectors/use-cases/get-month-expense-by-sector'

export function MakeGetMonthExpenseBySectorUseCase() {
    const transactionsRepository = new PrismaTransactionsRepository()
    const getMonthExpenseBySectorUseCase = new GetMonthExpenseBySectorUseCase(transactionsRepository)
    return getMonthExpenseBySectorUseCase
}
