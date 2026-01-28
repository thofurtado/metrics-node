import { PrismaItemsRepository } from '@/repositories/prisma/prisma-items-repository'
import { UpdateItemUseCase } from '../update-item'
import { PrismaStocksRepository } from '@/repositories/prisma/prisma-stocks-repository'

export function makeUpdateItemUseCase() {
    const itemsRepository = new PrismaItemsRepository()
    const useCase = new UpdateItemUseCase(itemsRepository)
    return useCase
}
