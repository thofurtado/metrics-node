import { PrismaTransactionsRepository } from '@/repositories/prisma/prisma-transactions-repository'
import { GetGeneralBalanceUseCase } from '../get-general-balance'

export function MakeGetGeneralBalanceUseCase() {
    const transactionsRepository = new PrismaTransactionsRepository()
    const getGeneralBalanceUseCase = new GetGeneralBalanceUseCase(transactionsRepository)
    return getGeneralBalanceUseCase
}
