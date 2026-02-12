import { PrismaTransactionsRepository } from '@/modules/financial/repositories/prisma/prisma-transactions-repository'
import { GetMonthIncomeByDaysUseCase } from '@/modules/financial/use-cases/get-month-income-by-days'

export function MakeGetMonthByDaysUseCase() {
    const transactionsRepository = new PrismaTransactionsRepository()
    const getMonthIncomeByDaysUseCase = new GetMonthIncomeByDaysUseCase(transactionsRepository)
    return getMonthIncomeByDaysUseCase
}
