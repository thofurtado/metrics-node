
import { PrismaTransactionsRepository } from '@/modules/financial/repositories/prisma/prisma-transactions-repository'
import { GetTransactionsUseCase } from '@/modules/financial/use-cases/get-transactions'

export function MakeGetTransactionsUseCase() {
    const transactionsRepository = new PrismaTransactionsRepository()
    const getTransactionUseCase = new GetTransactionsUseCase(transactionsRepository)
    return getTransactionUseCase
}
