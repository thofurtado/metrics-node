import { PrismaTransactionsRepository } from '@/modules/financial/repositories/prisma/prisma-transactions-repository'
import { DeleteFutureTransactionsUseCase } from '../delete-future-transactions-use-case'

export function MakeDeleteFutureTransactionsUseCase() {
    const transactionsRepository = new PrismaTransactionsRepository()
    const useCase = new DeleteFutureTransactionsUseCase(transactionsRepository)

    return useCase
}
