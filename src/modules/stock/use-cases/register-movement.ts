import { StocksRepository, StockOperation, StockReason } from '@/modules/stock/repositories/stocks-repository'
import { ProductsRepository } from '@/modules/items/repositories/products-repository'
import { SuppliesRepository } from '@/repositories/supplies-repository'
import { ResourceNotFoundError } from '@/errors/resource-not-found-error'
import { OnlyNaturalNumbersError } from '@/errors/only-natural-numbers-error'
import { InvalidOptionError } from '@/errors/invalid-option-error'
import { Stock } from '@prisma/client'
import { prisma } from '@/lib/prisma'

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

        if (quantity <= 0) throw new OnlyNaturalNumbersError()
        if (operation !== 'IN' && operation !== 'OUT') throw new InvalidOptionError()

        const executeLogic = async (tx?: any) => {
            const product = await this.productsRepository.findById(item_id)

            if (product) {
                const isComposite = product.is_composite || product.product?.is_composite || false
                if (isComposite) {
                    throw new Error("Não é possível ajustar manualmente o estoque de produtos compostos.")
                }

                const currentCost = product.cost ?? product.product?.cost ?? 0
                const costToRegister = unit_cost ?? currentCost

                const stockData: any = {
                    quantity,
                    operation: operation as StockOperation,
                    description: description as StockReason,
                    created_at: created_at ?? new Date(),
                    unit_cost: costToRegister,
                    product_id: item_id
                }

                const stock_movement = await this.stocksRepository.create(stockData, tx)

                const isEntry = operation === 'IN'
                const costUpdate = (isEntry && unit_cost !== undefined) ? unit_cost : undefined

                const currentStock = product.stock ?? product.product?.stock ?? (product as any).stock ?? 0
                const newStock = isEntry
                    ? currentStock + quantity
                    : currentStock - quantity

                await this.productsRepository.update(item_id, {
                    stock: newStock,
                    ...(costUpdate !== undefined && { cost: costUpdate })
                }, tx)

                return {
                    new_balance: newStock,
                    stock_movement
                }
            }

            const supply = await this.suppliesRepository.findById(item_id)

            if (supply) {
                const currentCost = supply.cost ?? 0
                const costToRegister = unit_cost ?? currentCost

                const stockData: any = {
                    quantity,
                    operation: operation as StockOperation,
                    description: description as StockReason,
                    created_at: created_at ?? new Date(),
                    unit_cost: costToRegister,
                    supply_id: item_id
                }

                const stock_movement = await this.stocksRepository.create(stockData, tx)

                const isEntry = operation === 'IN'
                const costUpdate = (isEntry && unit_cost !== undefined) ? unit_cost : undefined

                const newStock = isEntry
                    ? supply.stock + quantity
                    : supply.stock - quantity

                await this.suppliesRepository.update(item_id, {
                    stock: newStock,
                    ...(costUpdate !== undefined && { cost: costUpdate })
                }, tx)

                return {
                    new_balance: newStock,
                    stock_movement
                }
            }

            throw new ResourceNotFoundError()
        }

        if (this.stocksRepository.constructor.name.includes("InMemory")) {
            return await executeLogic()
        }

        return await prisma.$transaction(async (tx) => {
            return await executeLogic(tx)
        })
    }
}
