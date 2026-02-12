import { PrismaProductsRepository } from '@/modules/products/repositories/prisma/prisma-products-repository'
import { CheckProductCodeAvailabilityUseCase } from '@/modules/products/use-cases/check-product-code-availability'

export function makeCheckProductCodeAvailabilityUseCase() {
    const productsRepository = new PrismaProductsRepository()
    const checkProductCodeAvailabilityUseCase = new CheckProductCodeAvailabilityUseCase(productsRepository)

    return checkProductCodeAvailabilityUseCase
}
