import { PrismaProductsRepository } from '@/modules/products/repositories/prisma/prisma-products-repository'
import { PrismaServicesRepository } from '@/modules/services/repositories/prisma/prisma-services-repository'
import { PrismaSuppliesRepository } from '@/repositories/prisma/prisma-supplies-repository'
import { DeleteItemUseCase } from '@/modules/items/use-cases/delete-item'

export function makeDeleteItemUseCase() {
    const productsRepository = new PrismaProductsRepository()
    const servicesRepository = new PrismaServicesRepository()
    const suppliesRepository = new PrismaSuppliesRepository()

    const useCase = new DeleteItemUseCase(productsRepository, servicesRepository, suppliesRepository)

    return useCase
}
