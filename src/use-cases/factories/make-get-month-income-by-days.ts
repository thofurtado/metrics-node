import { PrismaTransactionsRepository } from '@/repositories/prisma/prisma-transactions-repository'
import { GetMonthIncomeByDaysUseCase } from '../get-month-income-by-days'

export function MakeGetMonthByDaysUseCase() {
    const transactionsRepository = new PrismaTransactionsRepository()
    const getMonthIncomeByDaysUseCase = new GetMonthIncomeByDaysUseCase(transactionsRepository)
    return getMonthIncomeByDaysUseCase
}
