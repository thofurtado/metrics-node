// use-cases/get-inventory-summary.ts
import { InventoryRepository } from '@/repositories/inventory-repository'

interface GetInventorySummaryUseCaseResponse {
    inventorySummary: {
        patrimony: number
        productsSold: number
        servicesSold: number
        productsBudget: number
        servicesBudget: number
    }
}

export class GetInventorySummaryUseCase {
    constructor(
        private inventoryRepository: InventoryRepository
    ) { }

    async execute(): Promise<GetInventorySummaryUseCaseResponse> {
        const inventorySummary = await this.inventoryRepository.getInventorySummary()

        return { inventorySummary }
    }
}