import { ItemsRepository } from '@/repositories/items-repository'
import { Item } from '@prisma/client'
import { ThisNameAlreadyExistsError } from './errors/this-name-already-exists-error'
import { StocksRepository } from '@/repositories/stocks-repository'
import { PriceCannotBeLowerThanCost } from './errors/price-cannot-be-lower-than-cost-error'
import { OnlyNaturalNumbersError } from './errors/only-natural-numbers-error'
import { DisplayIdAlreadyExistsError } from './errors/display-id-already-exists-error'
import { prisma } from '@/lib/prisma'

interface ItemUseCaseRequest {
    name: string,
    description?: string,
    cost: number,
    price: number,
    stock?: number,
    min_stock?: number,
    barcode?: string,
    category?: string,
    active?: boolean,
    isItem?: boolean,
    display_id?: number
}
interface ItemUseCaseResponse {
    item: Item
}
export class ItemUseCase {

    constructor(
        private itemsRepository: ItemsRepository,
        private stockRepository: StocksRepository
    ) { }
    async execute({
        name, description, cost, price, stock, min_stock, barcode, category, active, isItem, display_id
    }: ItemUseCaseRequest): Promise<ItemUseCaseResponse> {

        const existentName = await this.itemsRepository.findByName(name)

        if (existentName) {
            throw new ThisNameAlreadyExistsError()
        }

        if (display_id) {
            const existingWithId = await this.itemsRepository.findMany(undefined, undefined, 1, 1, undefined, display_id)
            if (existingWithId && existingWithId.items && existingWithId.items.length > 0) {
                throw new DisplayIdAlreadyExistsError()
            }
        }

        if (price < cost)
            throw new PriceCannotBeLowerThanCost()


        if (cost < 0 || price < 0)
            throw new OnlyNaturalNumbersError()

        return await prisma.$transaction(async (tx) => {
            if (stock) {
                if (stock < 0)
                    throw new OnlyNaturalNumbersError()

                let finalDisplayId = display_id
                if (!finalDisplayId || isNaN(finalDisplayId)) {
                    finalDisplayId = await this.itemsRepository.findNextAvailableDisplayId(tx)
                }

                const item = await this.itemsRepository.create({
                    name, description, cost, price, stock, min_stock, barcode, category, active, isItem, display_id: finalDisplayId
                }, tx)

                if (stock !== 0)
                    await this.stockRepository.create({
                        item_id: item.id,
                        quantity: stock,
                        operation: 'IN',
                        description: 'AJUSTE_POSITIVO',
                        created_at: new Date()
                    }, tx)

                return {
                    item
                }
            }

            let finalDisplayId = display_id
            if (!finalDisplayId || isNaN(finalDisplayId)) {
                finalDisplayId = await this.itemsRepository.findNextAvailableDisplayId(tx)
            }

            const item = await this.itemsRepository.create({
                name, description, cost, price, stock: 0, min_stock, barcode, category, active, isItem, display_id: finalDisplayId
            }, tx)

            return {
                item
            }
        })
    }
}
