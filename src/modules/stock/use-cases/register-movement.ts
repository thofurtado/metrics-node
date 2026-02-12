import { StocksRepository } from '@/modules/stock/repositories/stocks-repository'
import { ItemsRepository } from '@/modules/items/repositories/items-repository'
import { Stock, StockOperation, StockReason } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { ResourceNotFoundError } from '@/errors/resource-not-found-error'
import { InvalidOptionError } from '@/errors/invalid-option-error'
import { StockCannotBeNegativaError } from '@/modules/stock/use-cases/stock-cannot-be-negative-error'
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
        private itemsRepository: ItemsRepository
    ) { }

    async execute({
        item_id,
        quantity,
        operation,
        description,
        created_at,
        unit_cost
    }: RegisterStockMovementUseCaseRequest): Promise<RegisterStockMovementUseCaseResponse> {

        // 1. Find Item
        const item = await this.itemsRepository.findById(item_id)

        if (!item) {
            throw new ResourceNotFoundError()
        }

        // 2. Validate Item Type and Composite Constraints
        if (item.type === 'SERVICE') {
            throw new Error("Serviços não possuem controle de estoque.")
        }

        if (item.type === 'PRODUCT' && item.product?.is_composite) {
            throw new Error("Não é possível ajustar manualmente o estoque de produtos compostos.")
        }

        // 3. Validate Quantity
        if (quantity <= 0) {
            throw new OnlyNaturalNumbersError()
        }

        if (operation !== 'IN' && operation !== 'OUT') {
            throw new InvalidOptionError()
        }

        // 4. Validate Stock Availability for OUT operations
        if (operation === 'OUT') {
            const currentStock = item.type === 'PRODUCT' ? (item.product?.stock ?? 0) : (item.supply?.stock ?? 0)

            // Ensure we don't go negative if that's a requirement (seems implied by StockCannotBeNegativaError)
            if (currentStock < quantity) {
                throw new StockCannotBeNegativaError()
            }
        }

        // 5. Execute Transaction (Create History + Update Balance + Update Cost)
        return await prisma.$transaction(async (tx) => {
            // Determine current cost if not provided
            const currentCost = item.type === 'PRODUCT' ? (item.product?.cost ?? 0) : (item.supply?.cost ?? 0)
            const costToRegister = unit_cost ?? currentCost

            // A. Create Stock Movement (History)
            const stockData: any = {
                quantity,
                operation: operation as StockOperation,
                description: description as StockReason, // Assuming frontend sends valid enum string or valid description
                created_at: created_at ?? new Date(),
                unit_cost: costToRegister
            }

            // Map item_id to correct foreign key
            if (item.type === 'PRODUCT') {
                stockData.product_id = item_id
            } else if (item.type === 'SUPPLY') {
                stockData.supply_id = item_id
            }

            const stock_movement = await this.stocksRepository.create(stockData, tx)

            // B. Update Item Balance & Cost (Ledger Logic)
            const isEntry = operation === 'IN'
            const stockUpdate = isEntry ? { increment: quantity } : { decrement: quantity }

            // Only update cost if it's an ENTRY and a new cost is provided
            const costUpdate = (isEntry && unit_cost !== undefined) ? unit_cost : undefined

            if (item.type === 'PRODUCT') {
                await tx.product.update({
                    where: { id: item_id },
                    data: {
                        stock: stockUpdate,
                        ...(costUpdate !== undefined && { cost: costUpdate })
                    }
                })
            } else if (item.type === 'SUPPLY') {
                await tx.supply.update({
                    where: { id: item_id },
                    data: {
                        stock: stockUpdate,
                        ...(costUpdate !== undefined && { cost: costUpdate })
                    }
                })
            }

            // C. Calculate New Balance for response
            // Fetch updated item to be sure, or calculate optimistically. 
            // Optimistic calculation is faster and safe within transaction logic if no other parallel tx updates it.
            // However, itemsRepository.findById doesn't support tx yet.
            // We'll calculate based on initial read + delta.
            const initialStock = item.type === 'PRODUCT' ? (item.product?.stock ?? 0) : (item.supply?.stock ?? 0)
            const new_balance = isEntry
                ? initialStock + quantity
                : initialStock - quantity

            return {
                new_balance,
                stock_movement
            }
        })
    }
}
