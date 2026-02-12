
import { PrismaStocksRepository } from '@/modules/stock/repositories/prisma/prisma-stocks-repository'
import { GetStocksByItemUseCase } from '@/modules/stock/use-cases/get-stock-by-item'

export function MakeGetStocksUseCase() {
    const stocksRepository = new PrismaStocksRepository()
    const getStockUseCase = new GetStocksByItemUseCase(stocksRepository)
    return getStockUseCase
}
