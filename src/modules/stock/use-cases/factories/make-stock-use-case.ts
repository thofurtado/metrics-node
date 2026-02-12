import { PrismaStocksRepository } from '@/modules/stock/repositories/prisma/prisma-stocks-repository'
import { StockUseCase } from '@/modules/stock/use-cases/stock'
import { PrismaItemsRepository } from '@/modules/items/repositories/prisma/prisma-items-repository'




export function MakeStockUseCase() {
    const stocksRepository = new PrismaStocksRepository()
    const itemsRepository = new PrismaItemsRepository()
    const stockUseCase = new StockUseCase(stocksRepository, itemsRepository)
    return stockUseCase
}
