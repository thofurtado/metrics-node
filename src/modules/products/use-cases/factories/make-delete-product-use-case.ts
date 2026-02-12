import { PrismaProductsRepository } from '@/modules/products/repositories/prisma/prisma-products-repository'
import { DeleteProductUseCase } from '@/modules/products/use-cases/delete-product'

export function makeDeleteProductUseCase() {
    const productsRepository = new PrismaProductsRepository()
    const useCase = new DeleteProductUseCase(productsRepository)

    return useCase
}
