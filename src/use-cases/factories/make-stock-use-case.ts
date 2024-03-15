import { PrismaStocksRepository } from '@/repositories/prisma/prisma-stocks-repository'
import { StockUseCase } from '../stock'
import { PrismaItemsRepository } from '@/repositories/prisma/prisma-items-repository'




export function MakeStockUseCase() {
    const stocksRepository = new PrismaStocksRepository()
    const itemsRepository = new PrismaItemsRepository()
    const stockUseCase = new StockUseCase(stocksRepository, itemsRepository)
    return stockUseCase
}
