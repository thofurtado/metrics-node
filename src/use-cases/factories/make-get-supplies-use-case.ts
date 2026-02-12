import { PrismaSuppliesRepository } from '@/repositories/prisma/prisma-supplies-repository'
import { GetSuppliesUseCase } from '@/modules/supplies/use-cases/get-supplies'

export function makeGetSuppliesUseCase() {
    const suppliesRepository = new PrismaSuppliesRepository()
    const getSuppliesUseCase = new GetSuppliesUseCase(suppliesRepository)

    return getSuppliesUseCase
}
