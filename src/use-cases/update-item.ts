import { ItemsRepository } from '@/repositories/items-repository'
import { Item, ItemType } from '@prisma/client'
import { ResourceNotFoundError } from './errors/resource-not-found-error'

interface UpdateItemUseCaseRequest {
    id: string
    name?: string
    description?: string | null
    cost?: number | null
    price?: number | null
    min_stock?: number | null
    barcode?: string | null
    category?: string | null
    active?: boolean | null
    estimated_time?: string | null
    unit?: string | null
    display_id?: number | null
    ncm?: string | null
}

interface UpdateItemUseCaseResponse {
    item: Item
}

export class UpdateItemUseCase {
    constructor(private itemsRepository: ItemsRepository) { }

    async execute(data: UpdateItemUseCaseRequest): Promise<UpdateItemUseCaseResponse> {
        const existentItem = await this.itemsRepository.findById(data.id)

        if (!existentItem) {
            throw new ResourceNotFoundError()
        }

        const type = existentItem.type

        const payload: any = {
            id: data.id, // Mandatory for the repository.update method to find the record
            name: data.name,
            description: data.description,
            category: data.category,
            active: data.active,
        }

        if (type === ItemType.PRODUCT) {
            payload.product = {
                update: {
                    price: data.price,
                    min_stock: data.min_stock,
                    barcode: data.barcode,
                    ncm: (data as any).ncm, // Ensure NCM update
                    display_id: data.display_id
                }
            }
        } else if (type === ItemType.SERVICE) {
            payload.service = {
                update: {
                    price: data.price,
                    estimated_time: data.estimated_time,
                    display_id: data.display_id
                }
            }
        } else if (type === ItemType.SUPPLY) {
            payload.supply = {
                update: {
                    cost: data.cost,
                    unit: data.unit
                }
            }
        }

        const item = await this.itemsRepository.update(payload)
        return { item }
    }
}
