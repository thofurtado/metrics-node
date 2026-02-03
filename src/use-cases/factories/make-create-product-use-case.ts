import { PrismaProductsRepository } from '@/repositories/prisma/prisma-products-repository'
import { PrismaSuppliesRepository } from '@/repositories/prisma/prisma-supplies-repository'
import { CreateProductUseCase } from '../products/create-product'

export function makeCreateProductUseCase() {
    const productsRepository = new PrismaProductsRepository()
    const suppliesRepository = new PrismaSuppliesRepository()
    const createProductUseCase = new CreateProductUseCase(productsRepository, suppliesRepository)

    return createProductUseCase
}
