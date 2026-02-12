import { PrismaProductsRepository } from '@/modules/products/repositories/prisma/prisma-products-repository'
import { GetProductByIdUseCase } from '@/modules/products/use-cases/get-product-by-id'

export function makeGetProductByIdUseCase() {
    const productsRepository = new PrismaProductsRepository()
    const useCase = new GetProductByIdUseCase(productsRepository)

    return useCase
}
