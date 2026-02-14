import { StocksRepository } from '@/modules/stock/repositories/stocks-repository'
import { Stock, Product, Supply } from '@prisma/client'
import { OnlyNaturalNumbersError } from '@/errors/only-natural-numbers-error'
import { ResourceNotFoundError } from '@/errors/resource-not-found-error'
import { InvalidOptionError } from '@/errors/invalid-option-error'
import { prisma } from '@/lib/prisma'

import { ProductsRepository } from '@/modules/items/repositories/products-repository'
import { SuppliesRepository } from '@/modules/items/repositories/supplies-repository'
import { ServicesRepository } from '@/modules/items/repositories/services-repository' // To check if it is a service

interface StockUseCaseRequest {
    item_id: string,
    quantity: number,
    operation: string,
    description?: string,
    created_at?: Date
}
interface StockUseCaseResponse {
    stock: Stock
}
export class StockUseCase {

    constructor(
        private stocksRepository: StocksRepository,
        private productsRepository: ProductsRepository,
        private suppliesRepository: SuppliesRepository,
        private servicesRepository: ServicesRepository
    ) { }
    async execute({
        item_id, quantity, operation, description, created_at
    }: StockUseCaseRequest): Promise<StockUseCaseResponse> {

        let product: Product | any | null = null
        let supply: Supply | null = null
        let itemType: 'PRODUCT' | 'SERVICE' | 'SUPPLY' | null = null

        // Try Product
        product = await this.productsRepository.findById(item_id)
        if (product) {
            itemType = 'PRODUCT'
        } else {
            // Try Supply
            supply = await this.suppliesRepository.findById(item_id)
            if (supply) {
                itemType = 'SUPPLY'
            } else {
                // Try Service (to give correct error message)
                const service = await this.servicesRepository.findById(item_id)
                if (service) {
                    itemType = 'SERVICE'
                }
            }
        }

        if (!itemType)
            throw new ResourceNotFoundError()

        if (itemType === 'SERVICE') {
            throw new Error('Serviços não possuem controle de estoque.')
        }

        if (quantity <= 0)
            throw new OnlyNaturalNumbersError()

        if (operation !== 'IN' && operation !== 'OUT')
            throw new InvalidOptionError()

        return await prisma.$transaction(async (tx) => {
            const stockData: any = {
                quantity,
                operation: operation as any,
                description: description as any,
                created_at
            }

            if (itemType === 'PRODUCT') {
                stockData.product_id = item_id
                await this.productsRepository.changeStock(item_id, quantity, operation === 'IN', tx)
            } else if (itemType === 'SUPPLY') {
                stockData.supply_id = item_id
                await this.suppliesRepository.changeStock(item_id, quantity, operation === 'IN', tx)
            }

            const stock = await this.stocksRepository.create(stockData, tx)

            return {
                stock
            }
        })
    }
}
