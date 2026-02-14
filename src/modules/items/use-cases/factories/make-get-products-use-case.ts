import { PrismaProductsRepository } from '../../repositories/prisma/prisma-products-repository'
import { GetProductsUseCase } from '../get-products'

export function makeGetProductsUseCase() {
    const productsRepository = new PrismaProductsRepository()
    const getProductsUseCase = new GetProductsUseCase(productsRepository)

    return getProductsUseCase
}
