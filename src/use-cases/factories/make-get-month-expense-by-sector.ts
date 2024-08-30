import { PrismaTransactionsRepository } from '@/repositories/prisma/prisma-transactions-repository'
import { GetMonthExpenseBySectorUseCase } from '../get-month-expense-by-sector'

export function MakeGetMonthExpenseBySectorUseCase() {
    const transactionsRepository = new PrismaTransactionsRepository()
    const getMonthExpenseBySectorUseCase = new GetMonthExpenseBySectorUseCase(transactionsRepository)
    return getMonthExpenseBySectorUseCase
}
