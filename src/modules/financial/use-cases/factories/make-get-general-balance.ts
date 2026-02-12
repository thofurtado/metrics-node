import { PrismaTransactionsRepository } from '@/modules/financial/repositories/prisma/prisma-transactions-repository'
import { GetGeneralBalanceUseCase } from '@/modules/financial/use-cases/get-general-balance'

export function MakeGetGeneralBalanceUseCase() {
    const transactionsRepository = new PrismaTransactionsRepository()
    const getGeneralBalanceUseCase = new GetGeneralBalanceUseCase(transactionsRepository)
    return getGeneralBalanceUseCase
}
