import { PrismaProductsRepository } from '@/modules/items/repositories/prisma/prisma-products-repository'
import { PrismaServicesRepository } from '@/modules/items/repositories/prisma/prisma-services-repository'
import { PrismaSuppliesRepository } from '@/modules/items/repositories/prisma/prisma-supplies-repository'
import { DeleteItemUseCase } from '../delete-item'

export function makeDeleteItemUseCase() {
    const productsRepository = new PrismaProductsRepository()
    const servicesRepository = new PrismaServicesRepository()
    const suppliesRepository = new PrismaSuppliesRepository()

    return new DeleteItemUseCase(productsRepository, servicesRepository, suppliesRepository)
}
