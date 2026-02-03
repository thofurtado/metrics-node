import { PrismaSuppliesRepository } from '@/repositories/prisma/prisma-supplies-repository'
import { CreateSupplyUseCase } from '../supplies/create-supply'

export function makeCreateSupplyUseCase() {
    const suppliesRepository = new PrismaSuppliesRepository()
    const createSupplyUseCase = new CreateSupplyUseCase(suppliesRepository)

    return createSupplyUseCase
}

