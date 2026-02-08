
import { PrismaTransactionsRepository } from '@/repositories/prisma/prisma-transactions-repository'
import { BulkPayTransactionsUseCase } from '../bulk-pay-transactions'

export function MakeBulkPayTransactionsUseCase() {
    const transactionsRepository = new PrismaTransactionsRepository()
    const useCase = new BulkPayTransactionsUseCase(transactionsRepository)
    return useCase
}
