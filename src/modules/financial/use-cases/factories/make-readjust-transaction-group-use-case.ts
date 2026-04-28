import { PrismaTransactionsRepository } from '@/modules/financial/repositories/prisma/prisma-transactions-repository'
import { ReadjustTransactionGroupUseCase } from '../readjust-transaction-group-use-case'

export function MakeReadjustTransactionGroupUseCase() {
    const transactionsRepository = new PrismaTransactionsRepository()
    const useCase = new ReadjustTransactionGroupUseCase(transactionsRepository)

    return useCase
}
