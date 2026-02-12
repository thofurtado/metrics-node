import { PrismaProductsRepository } from '@/modules/products/repositories/prisma/prisma-products-repository'
import { GetNextProductIdUseCase } from '@/modules/products/use-cases/get-next-product-id'

export function makeGetNextProductIdUseCase() {
    const productsRepository = new PrismaProductsRepository()
    const getNextProductIdUseCase = new GetNextProductIdUseCase(productsRepository)

    return getNextProductIdUseCase
}
