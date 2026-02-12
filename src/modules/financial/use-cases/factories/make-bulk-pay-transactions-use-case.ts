
import { PrismaTransactionsRepository } from '@/modules/financial/repositories/prisma/prisma-transactions-repository'
import { BulkPayTransactionsUseCase } from '@/modules/financial/use-cases/bulk-pay-transactions'

export function MakeBulkPayTransactionsUseCase() {
    const transactionsRepository = new PrismaTransactionsRepository()
    const useCase = new BulkPayTransactionsUseCase(transactionsRepository)
    return useCase
}
