import { PrismaInventoryRepository } from '@/repositories/prisma/prisma-inventory-repository'
import { GetInventorySummaryUseCase } from '../get-inventory-summary'

export function MakeGetInventorySummaryUseCase() {
    const inventoryRepository = new PrismaInventoryRepository()
    const getInventorySummaryUseCase = new GetInventorySummaryUseCase(inventoryRepository)
    return getInventorySummaryUseCase
}