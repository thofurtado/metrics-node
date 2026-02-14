import { StocksRepository } from '@/modules/stock/repositories/stocks-repository'
import { ProductsRepository } from '@/modules/items/repositories/products-repository'
import { SuppliesRepository } from '@/modules/items/repositories/supplies-repository'
import { Stock, StockOperation, StockReason } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { ResourceNotFoundError } from '@/errors/resource-not-found-error'
import { InvalidOptionError } from '@/errors/invalid-option-error'
import { OnlyNaturalNumbersError } from '@/errors/only-natural-numbers-error'

interface RegisterStockMovementUseCaseRequest {
    item_id: string
    quantity: number
    operation: 'IN' | 'OUT'
    description?: string
    created_at?: Date
    unit_cost?: number
}

interface RegisterStockMovementUseCaseResponse {
    new_balance: number
    stock_movement: Stock
}

export class RegisterStockMovementUseCase {
    constructor(
        private stocksRepository: StocksRepository,
        private productsRepository: ProductsRepository,
        private suppliesRepository: SuppliesRepository
    ) { }

    async execute({
        item_id,
        quantity,
        operation,
        description,
        created_at,
        unit_cost
    }: RegisterStockMovementUseCaseRequest): Promise<RegisterStockMovementUseCaseResponse> {

        // Validate Inputs
        if (quantity <= 0) throw new OnlyNaturalNumbersError()
        if (operation !== 'IN' && operation !== 'OUT') throw new InvalidOptionError()

        return await prisma.$transaction(async (tx) => {
            // 1. Try Product
            const product = await this.productsRepository.findById(item_id)

            if (product) {
                if (product.is_composite) {
                    throw new Error("Não é possível ajustar manualmente o estoque de produtos compostos.")
                }

                const currentCost = product.cost ?? 0
                const costToRegister = unit_cost ?? currentCost

                // A. Create Stock Movement
                const stockData: any = {
                    quantity,
                    operation: operation as StockOperation,
                    description: description as StockReason,
                    created_at: created_at ?? new Date(),
                    unit_cost: costToRegister,
                    product_id: item_id
                }

                const stock_movement = await this.stocksRepository.create(stockData, tx)

                // B. Update Product Balance & Cost
                const isEntry = operation === 'IN'
                const costUpdate = (isEntry && unit_cost !== undefined) ? unit_cost : undefined

                const newStock = isEntry
                    ? (product.stock ?? 0) + quantity
                    : (product.stock ?? 0) - quantity

                await this.productsRepository.update(item_id, {
                    stock: newStock,
                    ...(costUpdate !== undefined && { cost: costUpdate })
                }, tx)

                return {
                    new_balance: newStock,
                    stock_movement
                }
            }

            // 2. Try Supply
            const supply = await this.suppliesRepository.findById(item_id)

            if (supply) {
                const currentCost = supply.cost
                const costToRegister = unit_cost ?? currentCost

                // A. Create Stock Movement
                const stockData: any = {
                    quantity,
                    operation: operation as StockOperation,
                    description: description as StockReason,
                    created_at: created_at ?? new Date(),
                    unit_cost: costToRegister,
                    supply_id: item_id
                }

                const stock_movement = await this.stocksRepository.create(stockData, tx)

                // B. Update Supply Balance & Cost
                const isEntry = operation === 'IN'
                const costUpdate = (isEntry && unit_cost !== undefined) ? unit_cost : undefined

                const newStock = isEntry
                    ? (supply.stock ?? 0) + quantity
                    : (supply.stock ?? 0) - quantity

                await this.suppliesRepository.update(item_id, {
                    stock: newStock,
                    ...(costUpdate !== undefined && { cost: costUpdate })
                }, tx)

                return {
                    new_balance: newStock,
                    stock_movement
                }
            }

            // If checking services specifically desired to throw explicit error:
            // Just throw Not Found implies it's not a stockable item.
            throw new ResourceNotFoundError()
        })
    }
}


