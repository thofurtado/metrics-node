import { PrismaSuppliesRepository } from '@/repositories/prisma/prisma-supplies-repository'
import { GetSuppliesUseCase } from '../supplies/get-supplies'

export function makeGetSuppliesUseCase() {
    const suppliesRepository = new PrismaSuppliesRepository()
    const getSuppliesUseCase = new GetSuppliesUseCase(suppliesRepository)

    return getSuppliesUseCase
}
