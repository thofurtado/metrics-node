import { PrismaProductsRepository } from '@/repositories/prisma/prisma-products-repository'
import { GetProductByIdUseCase } from '../products/get-product-by-id'

export function makeGetProductByIdUseCase() {
    const productsRepository = new PrismaProductsRepository()
    const useCase = new GetProductByIdUseCase(productsRepository)

    return useCase
}
