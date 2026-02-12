import { PrismaTransactionsRepository } from '@/modules/financial/repositories/prisma/prisma-transactions-repository'
import { TerminateTransactionGroupUseCase } from '@/modules/financial/use-cases/terminate-transaction-group'

export function MakeTerminateTransactionGroupUseCase() {
    const transactionsRepository = new PrismaTransactionsRepository()
    return new TerminateTransactionGroupUseCase(transactionsRepository)
}
