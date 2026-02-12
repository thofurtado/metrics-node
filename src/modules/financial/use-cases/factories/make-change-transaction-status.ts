import { ChangeTransactionUseCase } from '@/modules/financial/use-cases/change-transaction-status'
import { PrismaTransactionsRepository } from '@/modules/financial/repositories/prisma/prisma-transactions-repository'




export function MakeChangeTransactionStatusUseCase() {
    const transactionsRepository = new PrismaTransactionsRepository()
    const changeTransactionUseCase = new ChangeTransactionUseCase(
        transactionsRepository
    )
    return changeTransactionUseCase
}
