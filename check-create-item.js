"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const prisma_items_repository_1 = require("./src/repositories/prisma/prisma-items-repository");
const prisma_stocks_repository_1 = require("./src/repositories/prisma/prisma-stocks-repository");
const item_1 = require("./src/use-cases/item");
const client_1 = require("@prisma/client");
async function run() {
    const itemsRepo = new prisma_items_repository_1.PrismaItemsRepository();
    const stocksRepo = new prisma_stocks_repository_1.PrismaStocksRepository();
    const useCase = new item_1.ItemUseCase(itemsRepo, stocksRepo);
    // Test 1: Minimal Product
    try {
        console.log("---------------------------------------------------");
        console.log("Testing Minimal Product Create (Name + Price only)...");
        const result = await useCase.execute({
            name: "Autotest Product " + Date.now(),
            type: client_1.ItemType.PRODUCT,
            price: 10.50
            // No min_stock, no display_id
            // Expect: display_id generated, min_stock=0
        });
        console.log("✅ SUCCESS Product Created. ID:", result.item.id);
    }
    catch (e) {
        console.error("❌ FAILED Product:", e.message || e);
    }
    // Test 2: Minimal Supply
    try {
        console.log("---------------------------------------------------");
        console.log("Testing Minimal Supply Create (Name + Cost only)...");
        const result = await useCase.execute({
            name: "Autotest Supply " + Date.now(),
            type: client_1.ItemType.SUPPLY,
            cost: 5.00
            // No unit. Expect: unit='UN' (via our fix)
        });
        console.log("✅ SUCCESS Supply Created. ID:", result.item.id);
    }
    catch (e) {
        console.error("❌ FAILED Supply:", e.message || e);
    }
    console.log("---------------------------------------------------");
}
run();
