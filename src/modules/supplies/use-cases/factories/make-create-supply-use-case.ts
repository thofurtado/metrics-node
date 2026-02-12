import { PrismaSuppliesRepository } from '@/repositories/prisma/prisma-supplies-repository'
import { CreateSupplyUseCase } from '@/modules/supplies/use-cases/create-supply'

export function makeCreateSupplyUseCase() {
    const suppliesRepository = new PrismaSuppliesRepository()
    const createSupplyUseCase = new CreateSupplyUseCase(suppliesRepository)

    return createSupplyUseCase
}

