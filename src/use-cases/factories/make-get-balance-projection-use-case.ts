import { PrismaBalanceProjectionRepository } from '@/repositories/prisma/prisma-balance-projection-repository'
import { GetBalanceProjectionUseCase } from '../get-balance-projection'

export function MakeGetBalanceProjectionUseCase() {
    const balanceProjectionRepository = new PrismaBalanceProjectionRepository()
    const getBalanceProjectionUseCase = new GetBalanceProjectionUseCase(balanceProjectionRepository)
    return getBalanceProjectionUseCase
}