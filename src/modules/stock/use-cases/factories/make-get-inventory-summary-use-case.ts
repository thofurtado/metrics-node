import { PrismaInventoryRepository } from '@/modules/stock/repositories/prisma/prisma-inventory-repository'
import { GetInventorySummaryUseCase } from '@/modules/stock/use-cases/get-inventory-summary'

export function MakeGetInventorySummaryUseCase() {
    const inventoryRepository = new PrismaInventoryRepository()
    const getInventorySummaryUseCase = new GetInventorySummaryUseCase(inventoryRepository)
    return getInventorySummaryUseCase
}