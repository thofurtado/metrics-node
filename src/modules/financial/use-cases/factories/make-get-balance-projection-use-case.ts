import { PrismaBalanceProjectionRepository } from '@/modules/financial/repositories/prisma/prisma-balance-projection-repository'
import { GetBalanceProjectionUseCase } from '@/modules/financial/use-cases/get-balance-projection'

export function MakeGetBalanceProjectionUseCase() {
    const balanceProjectionRepository = new PrismaBalanceProjectionRepository()
    const getBalanceProjectionUseCase = new GetBalanceProjectionUseCase(balanceProjectionRepository)
    return getBalanceProjectionUseCase
}