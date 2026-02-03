import { PrismaProductsRepository } from '@/repositories/prisma/prisma-products-repository'
import { PrismaSuppliesRepository } from '@/repositories/prisma/prisma-supplies-repository'
import { UpdateProductUseCase } from '../products/update-product'

export function makeUpdateProductUseCase() {
    const productsRepository = new PrismaProductsRepository()
    const suppliesRepository = new PrismaSuppliesRepository()
    const useCase = new UpdateProductUseCase(productsRepository, suppliesRepository)

    return useCase
}
