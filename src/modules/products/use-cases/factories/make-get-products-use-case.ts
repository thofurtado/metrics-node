import { PrismaProductsRepository } from '@/modules/products/repositories/prisma/prisma-products-repository'
import { GetProductsUseCase } from '@/modules/products/use-cases/get-products'

export function makeGetProductsUseCase() {
    const productsRepository = new PrismaProductsRepository()
    const getProductsUseCase = new GetProductsUseCase(productsRepository)

    return getProductsUseCase
}
