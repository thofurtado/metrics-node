import { PrismaTransactionsRepository } from '@/modules/financial/repositories/prisma/prisma-transactions-repository'
import { UpdateTransactionUseCase } from '@/modules/financial/use-cases/update-transaction'
import { PrismaAccountsRepository } from '@/modules/financial/repositories/prisma/prisma-accounts-repository'

export function MakeUpdateTransactionUseCase () {
    const transactionsRepository = new PrismaTransactionsRepository()
    const accountsRepository = new PrismaAccountsRepository()

    const useCase = new UpdateTransactionUseCase(transactionsRepository, accountsRepository)
    return useCase
}
