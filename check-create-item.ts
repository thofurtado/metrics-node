import { PrismaItemsRepository } from './src/repositories/prisma/prisma-items-repository'
import { PrismaStocksRepository } from './src/repositories/prisma/prisma-stocks-repository'
import { ItemUseCase } from './src/use-cases/item'
import { ItemType } from '@prisma/client'

async function run() {
    const itemsRepo = new PrismaItemsRepository()
    const stocksRepo = new PrismaStocksRepository()
    const useCase = new ItemUseCase(itemsRepo, stocksRepo)

    // Test 1: Minimal Product
    try {
        console.log("---------------------------------------------------")
        console.log("Testing Minimal Product Create (Name + Price only)...")
        const result = await useCase.execute({
            name: "Autotest Product " + Date.now(),
            type: ItemType.PRODUCT,
            price: 10.50
            // No min_stock, no display_id
            // Expect: display_id generated, min_stock=0
        })
        console.log("✅ SUCCESS Product Created. ID:", result.item.id)
    } catch (e: any) {
        console.error("❌ FAILED Product:", e.message || e)
    }

    // Test 2: Minimal Supply
    try {
        console.log("---------------------------------------------------")
        console.log("Testing Minimal Supply Create (Name + Cost only)...")
        const result = await useCase.execute({
            name: "Autotest Supply " + Date.now(),
            type: ItemType.SUPPLY,
            cost: 5.00
            // No unit. Expect: unit='UN' (via our fix)
        })
        console.log("✅ SUCCESS Supply Created. ID:", result.item.id)
    } catch (e: any) {
        console.error("❌ FAILED Supply:", e.message || e)
    }
    console.log("---------------------------------------------------")
}

run()
