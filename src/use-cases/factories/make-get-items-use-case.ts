
import { PrismaItemsRepository } from '@/repositories/prisma/prisma-items-repository'
import { GetItemsUseCase } from '../get-items'

export function MakeGetItemsUseCase() {
    const itemsRepository = new PrismaItemsRepository()
    const getItemUseCase = new GetItemsUseCase(itemsRepository)
    return getItemUseCase
}
