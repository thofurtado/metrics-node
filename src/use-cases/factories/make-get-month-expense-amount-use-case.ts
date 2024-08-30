import { PrismaTransactionsRepository } from '@/repositories/prisma/prisma-transactions-repository'
import { GetMonthExpenseAmountUseCase } from '../get-month-expense-amount'

export function MakeGetMonthExpenseAmountUseCase() {
    const transactionsRepository = new PrismaTransactionsRepository()
    const getTransactionProfileUseCase = new GetMonthExpenseAmountUseCase(transactionsRepository)
    return getTransactionProfileUseCase
}
