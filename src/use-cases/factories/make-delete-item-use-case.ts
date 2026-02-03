import { PrismaProductsRepository } from '@/repositories/prisma/prisma-products-repository'
import { PrismaServicesRepository } from '@/repositories/prisma/prisma-services-repository'
import { PrismaSuppliesRepository } from '@/repositories/prisma/prisma-supplies-repository'
import { DeleteItemUseCase } from '../delete-item'

export function makeDeleteItemUseCase() {
    const productsRepository = new PrismaProductsRepository()
    const servicesRepository = new PrismaServicesRepository()
    const suppliesRepository = new PrismaSuppliesRepository()

    const useCase = new DeleteItemUseCase(productsRepository, servicesRepository, suppliesRepository)

    return useCase
}
