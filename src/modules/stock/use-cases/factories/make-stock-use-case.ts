import { PrismaStocksRepository } from '@/modules/stock/repositories/prisma/prisma-stocks-repository'
import { StockUseCase } from '@/modules/stock/use-cases/stock'
import { PrismaProductsRepository } from '@/modules/items/repositories/prisma/prisma-products-repository'
import { PrismaSuppliesRepository } from '@/modules/items/repositories/prisma/prisma-supplies-repository'
import { PrismaServicesRepository } from '@/modules/items/repositories/prisma/prisma-services-repository'

export function MakeStockUseCase() {
    const stocksRepository = new PrismaStocksRepository()
    const productsRepository = new PrismaProductsRepository()
    const suppliesRepository = new PrismaSuppliesRepository()
    const servicesRepository = new PrismaServicesRepository()

    const stockUseCase = new StockUseCase(
        stocksRepository,
        productsRepository,
        suppliesRepository,
        servicesRepository
    )
    return stockUseCase
}
