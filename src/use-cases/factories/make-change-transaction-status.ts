import { ChangeTransactionUseCase } from '../change-transaction-status'
import { PrismaTransactionsRepository } from '@/repositories/prisma/prisma-transactions-repository'




export function MakeChangeTransactionStatusUseCase() {
    const transactionsRepository = new PrismaTransactionsRepository()
    const changeTransactionUseCase = new ChangeTransactionUseCase(
        transactionsRepository
    )
    return changeTransactionUseCase
}
