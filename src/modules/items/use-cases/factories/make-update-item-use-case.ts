import { PrismaItemsRepository } from '@/modules/items/repositories/prisma/prisma-items-repository'
import { UpdateItemUseCase } from '@/modules/items/use-cases/update-item'
import { PrismaStocksRepository } from '@/modules/stock/repositories/prisma/prisma-stocks-repository'

export function makeUpdateItemUseCase() {
    const itemsRepository = new PrismaItemsRepository()
    const useCase = new UpdateItemUseCase(itemsRepository)
    return useCase
}
