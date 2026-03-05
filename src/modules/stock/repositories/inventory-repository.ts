export interface InventorySummaryData {
    patrimony: number
    productsSold: number  // AGORA: valor total em R$
    servicesSold: number  // AGORA: valor total em R$
    productsBudget: number
    servicesBudget: number
}

export interface InventoryRepository {
    getInventorySummary(date?: Date): Promise<InventorySummaryData>
}