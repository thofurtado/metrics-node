import { StocksRepository } from '@/repositories/stocks-repository'
import { Stock } from '@prisma/client'
import { OnlyNaturalNumbersError } from './errors/only-natural-numbers-error'
import { ItemsRepository } from '@/repositories/items-repository'
import { ResourceNotFoundError } from './errors/resource-not-found-error'
import { InvalidOptionError } from './errors/invalid-option-error'
import { StockCannotBeNegativaError } from './errors/stock-cannot-be-negative-error'
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
            const stock = await this.stocksRepository.create({
                item_id,
                quantity,
                operation: operation as any, // Cast to match Prisma Enum if needed, usually string works if valid
                description: description as any,
                created_at
            }, tx)

            await this.itemsRepository.changeStock(findedItem.id, quantity, operation === 'IN' ? true : false, tx)

            return {
                stock
            }
        })
    }
}
