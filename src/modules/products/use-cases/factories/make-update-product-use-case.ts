import { PrismaProductsRepository } from '@/modules/products/repositories/prisma/prisma-products-repository'
import { PrismaSuppliesRepository } from '@/repositories/prisma/prisma-supplies-repository'
import { UpdateProductUseCase } from '@/modules/products/use-cases/update-product'

export function makeUpdateProductUseCase() {
    const productsRepository = new PrismaProductsRepository()
    const suppliesRepository = new PrismaSuppliesRepository()
    const useCase = new UpdateProductUseCase(productsRepository, suppliesRepository)

    return useCase
}
