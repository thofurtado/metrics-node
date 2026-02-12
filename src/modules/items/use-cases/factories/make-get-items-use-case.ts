
import { PrismaItemsRepository } from '@/modules/items/repositories/prisma/prisma-items-repository'
import { GetItemsUseCase } from '@/modules/items/use-cases/get-items'

export function MakeGetItemsUseCase() {
    const itemsRepository = new PrismaItemsRepository()
    const getItemUseCase = new GetItemsUseCase(itemsRepository)
    return getItemUseCase
}
