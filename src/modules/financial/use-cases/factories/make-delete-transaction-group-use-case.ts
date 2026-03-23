import { PrismaTransactionsRepository } from '@/modules/financial/repositories/prisma/prisma-transactions-repository'
import { DeleteTransactionGroupUseCase } from '../delete-transaction-group'

export function MakeDeleteTransactionGroupUseCase() {
    const transactionsRepository = new PrismaTransactionsRepository()
    const useCase = new DeleteTransactionGroupUseCase(transactionsRepository)
    return useCase
}
