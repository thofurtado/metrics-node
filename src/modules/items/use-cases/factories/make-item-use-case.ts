import { PrismaProductsRepository } from '@/modules/items/repositories/prisma/prisma-products-repository'
import { PrismaServicesRepository } from '@/modules/items/repositories/prisma/prisma-services-repository'
import { PrismaSuppliesRepository } from '@/modules/items/repositories/prisma/prisma-supplies-repository'
import { PrismaStocksRepository } from '@/modules/stock/repositories/prisma/prisma-stocks-repository'
import { CreateItemUseCase } from '../item'

export function MakeItemUseCase() {
    const productsRepository = new PrismaProductsRepository()
    const servicesRepository = new PrismaServicesRepository()
    const suppliesRepository = new PrismaSuppliesRepository()
    const stocksRepository = new PrismaStocksRepository()

    return new CreateItemUseCase(productsRepository, servicesRepository, suppliesRepository, stocksRepository)
}
