import { PrismaItemsRepository } from '@/repositories/prisma/prisma-items-repository'
import { DeleteItemUseCase } from '../delete-item'

export function makeDeleteItemUseCase() {
    const itemsRepository = new PrismaItemsRepository()
    const useCase = new DeleteItemUseCase(itemsRepository)
    return useCase
}
