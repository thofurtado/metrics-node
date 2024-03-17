
import { PrismaStocksRepository } from '@/repositories/prisma/prisma-stocks-repository'
import { GetStocksByItemUseCase } from '../get-stock-by-item'

export function MakeGetStocksUseCase() {
    const stocksRepository = new PrismaStocksRepository()
    const getStockUseCase = new GetStocksByItemUseCase(stocksRepository)
    return getStockUseCase
}
