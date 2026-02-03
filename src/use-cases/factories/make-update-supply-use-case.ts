import { PrismaSuppliesRepository } from '@/repositories/prisma/prisma-supplies-repository'
import { PrismaProductsRepository } from '@/repositories/prisma/prisma-products-repository'
import { UpdateSupplyUseCase } from '../supplies/update-supply'

export function makeUpdateSupplyUseCase() {
    const suppliesRepository = new PrismaSuppliesRepository()
    const productsRepository = new PrismaProductsRepository()
    const useCase = new UpdateSupplyUseCase(suppliesRepository, productsRepository)

    return useCase
}
