import { PrismaTransactionsRepository } from '@/repositories/prisma/prisma-transactions-repository'
import { GetMonthIncomeAmountUseCase } from '../get-month-income-amount'

export function MakeGetMonthIncomeAmountUseCase() {
    const transactionsRepository = new PrismaTransactionsRepository()
    const getTransactionProfileUseCase = new GetMonthIncomeAmountUseCase(transactionsRepository)
    return getTransactionProfileUseCase
}
