import { PrismaTransactionsRepository } from '@/repositories/prisma/prisma-transactions-repository'
import { TerminateTransactionGroupUseCase } from '../terminate-transaction-group'

export function MakeTerminateTransactionGroupUseCase() {
    const transactionsRepository = new PrismaTransactionsRepository()
    return new TerminateTransactionGroupUseCase(transactionsRepository)
}
