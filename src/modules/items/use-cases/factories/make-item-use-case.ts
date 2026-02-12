import { PrismaItemsRepository } from '@/modules/items/repositories/prisma/prisma-items-repository'
import { ItemUseCase } from '@/modules/items/use-cases/item'
import { PrismaStocksRepository } from '@/modules/stock/repositories/prisma/prisma-stocks-repository'




export function MakeItemUseCase() {
    const itemsRepository = new PrismaItemsRepository()
    const stocksRepository = new PrismaStocksRepository()
    const itemUseCase = new ItemUseCase(itemsRepository, stocksRepository)
    return itemUseCase
}
