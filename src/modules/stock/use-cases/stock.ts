import { StocksRepository } from '@/modules/stock/repositories/stocks-repository'
import { Stock } from '@prisma/client'
import { OnlyNaturalNumbersError } from '@/errors/only-natural-numbers-error'
import { ItemsRepository } from '@/modules/items/repositories/items-repository'
import { ResourceNotFoundError } from '@/errors/resource-not-found-error'
import { InvalidOptionError } from '@/errors/invalid-option-error'
import { StockCannotBeNegativaError } from '@/modules/stock/use-cases/stock-cannot-be-negative-error'
import { prisma } from '@/lib/prisma'

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
        private itemsRepository: ItemsRepository
    ) { }
    async execute({
        item_id, quantity, operation, description, created_at
    }: StockUseCaseRequest): Promise<StockUseCaseResponse> {

        const findedItem = await this.itemsRepository.findById(item_id)

        if (!findedItem)
            throw new ResourceNotFoundError()

        if (findedItem.type === 'SERVICE') {
            throw new Error('Serviços não possuem controle de estoque.')
        }

        if (quantity <= 0)
            throw new OnlyNaturalNumbersError()

        if (operation !== 'IN' && operation !== 'OUT')
            throw new InvalidOptionError()

        if (operation === 'OUT') {
            const itemBalance = await this.stocksRepository.getItemBalance(item_id)
            if (itemBalance < quantity)
                throw new StockCannotBeNegativaError()
        }

        return await prisma.$transaction(async (tx) => {
            const stockData: any = {
                quantity,
                operation: operation as any,
                description: description as any,
                created_at
            }

            if (findedItem.type === 'PRODUCT') {
                stockData.product_id = item_id
            } else if (findedItem.type === 'SUPPLY') {
                stockData.supply_id = item_id
            }

            const stock = await this.stocksRepository.create(stockData, tx)

            await this.itemsRepository.changeStock(findedItem.id, quantity, operation === 'IN' ? true : false, tx)

            return {
                stock
            }
        })
    }
}
