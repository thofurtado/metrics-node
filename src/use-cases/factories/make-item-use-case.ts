import { PrismaItemsRepository } from '@/repositories/prisma/prisma-items-repository'
import { ItemUseCase } from '../item'
import { PrismaStocksRepository } from '@/repositories/prisma/prisma-stocks-repository'




export function MakeItemUseCase() {
    const itemsRepository = new PrismaItemsRepository()
    const stocksRepository = new PrismaStocksRepository()
    const itemUseCase = new ItemUseCase(itemsRepository, stocksRepository)
    return itemUseCase
}
