
import { PrismaTransactionsRepository } from '@/repositories/prisma/prisma-transactions-repository'
import { GetTransactionsUseCase } from '../get-transactions'

export function MakeGetTransactionsUseCase() {
    const transactionsRepository = new PrismaTransactionsRepository()
    const getTransactionUseCase = new GetTransactionsUseCase(transactionsRepository)
    return getTransactionUseCase
}
