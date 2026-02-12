import { ItemsRepository } from '@/modules/items/repositories/items-repository'
import { Item, ItemType } from '@prisma/client'
import { ThisNameAlreadyExistsError } from '@/errors/this-name-already-exists-error'
import { StocksRepository } from '@/modules/stock/repositories/stocks-repository'
import { PriceCannotBeLowerThanCost } from '@/errors/price-cannot-be-lower-than-cost-error'
import { OnlyNaturalNumbersError } from '@/errors/only-natural-numbers-error'
import { DisplayIdAlreadyExistsError } from '@/errors/display-id-already-exists-error'
import { prisma } from '@/lib/prisma'

interface ItemUseCaseRequest {
    name: string,
    description?: string,
    cost?: number,
    price?: number,
    stock?: number,
    min_stock?: number,
    barcode?: string,
    category?: string,
    active?: boolean,
    type: ItemType,
    display_id?: number,
    ncm?: string,
    estimated_time?: string,
    unit?: string
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
        name, description, cost, price, stock, min_stock, barcode, category, active, type, display_id, ncm, estimated_time, unit
    }: ItemUseCaseRequest): Promise<ItemUseCaseResponse> {

        const existentName = await this.itemsRepository.findByName(name)

        if (existentName && existentName.length > 0) {
            throw new ThisNameAlreadyExistsError()
        }

        // Display ID Validation (Product/Service only)
        if (display_id && (type === ItemType.PRODUCT || type === ItemType.SERVICE)) {
            const conflicts = await this.itemsRepository.findMany(undefined, type, 1, 1, undefined, display_id)
            if (conflicts && conflicts.items && conflicts.items.length > 0) {
                throw new DisplayIdAlreadyExistsError()
            }
        }

        // Financial Validation
        if (price !== undefined && price < 0) throw new OnlyNaturalNumbersError()
        if (cost !== undefined && cost < 0) throw new OnlyNaturalNumbersError()

        // Stock Validation
        if (stock !== undefined && stock < 0) throw new OnlyNaturalNumbersError()

        return await prisma.$transaction(async (tx) => {
            let finalDisplayId: number | undefined = undefined

            if (type === ItemType.PRODUCT || type === ItemType.SERVICE) {
                finalDisplayId = display_id
                if (!finalDisplayId || isNaN(finalDisplayId)) {
                    finalDisplayId = await this.itemsRepository.findNextAvailableDisplayId(type, tx)
                }
            }

            const payload: any = {
                name,
                description,
                category,
                active,
                type
            }

            if (type === ItemType.PRODUCT) {
                payload.product = {
                    create: {
                        display_id: finalDisplayId,
                        price: price ?? 0,
                        stock: stock || 0,
                        min_stock: min_stock || 0,
                        barcode,
                        ncm
                    }
                }
            } else if (type === ItemType.SERVICE) {
                payload.service = {
                    create: {
                        display_id: finalDisplayId,
                        price: price ?? 0,
                        estimated_time
                    }
                }
            } else if (type === ItemType.SUPPLY) {
                payload.supply = {
                    create: {
                        cost: cost ?? 0,
                        stock: stock || 0,
                        unit: unit || 'UN'
                    }
                }
            }

            const item = await this.itemsRepository.create(payload, tx)

            // Stock Log
            if (stock && stock !== 0 && (type === ItemType.PRODUCT || type === ItemType.SUPPLY)) {

                await this.stockRepository.create({
                    item_id: item.id,
                    quantity: stock,
                    operation: 'IN',
                    description: 'AJUSTE_POSITIVO',
                    created_at: new Date()
                }, tx)
            }

            return {
                item
            }
        })
    }
}
