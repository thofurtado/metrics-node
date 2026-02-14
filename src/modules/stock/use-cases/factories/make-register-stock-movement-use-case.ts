import { PrismaStocksRepository } from '@/modules/stock/repositories/prisma/prisma-stocks-repository'
import { PrismaProductsRepository } from '@/modules/items/repositories/prisma/prisma-products-repository'
import { PrismaSuppliesRepository } from '@/modules/items/repositories/prisma/prisma-supplies-repository'
import { RegisterStockMovementUseCase } from '@/modules/stock/use-cases/register-movement'

export function MakeRegisterStockMovementUseCase() {
    const stocksRepository = new PrismaStocksRepository()
    const productsRepository = new PrismaProductsRepository()
    const suppliesRepository = new PrismaSuppliesRepository()

    return new RegisterStockMovementUseCase(stocksRepository, productsRepository, suppliesRepository)
}
