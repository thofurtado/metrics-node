export interface InventorySummaryData {
    patrimony: number
    productsSold: number  // AGORA: valor total em R$
    servicesSold: number  // AGORA: valor total em R$
}

export interface InventoryRepository {
    getInventorySummary(): Promise<InventorySummaryData>
}