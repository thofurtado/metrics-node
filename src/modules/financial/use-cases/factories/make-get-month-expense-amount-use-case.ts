import { PrismaTransactionsRepository } from '@/modules/financial/repositories/prisma/prisma-transactions-repository'
import { GetMonthExpenseAmountUseCase } from '@/modules/financial/use-cases/get-month-expense-amount'

export function MakeGetMonthExpenseAmountUseCase() {
    const transactionsRepository = new PrismaTransactionsRepository()
    const getTransactionProfileUseCase = new GetMonthExpenseAmountUseCase(transactionsRepository)
    return getTransactionProfileUseCase
}
