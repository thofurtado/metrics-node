import { ItemsRepository } from '@/repositories/items-repository'
import { Item } from '@prisma/client'

interface UpdateItemUseCaseRequest {
    id: string
    name?: string
    description?: string
    cost?: number
    price?: number
    min_stock?: number
    barcode?: string
    category?: string
    active?: boolean
    isItem?: boolean
}

interface UpdateItemUseCaseResponse {
    item: Item
}

export class UpdateItemUseCase {
    constructor(private itemsRepository: ItemsRepository) { }

    async execute(data: UpdateItemUseCaseRequest): Promise<UpdateItemUseCaseResponse> {
        const item = await this.itemsRepository.update(data)
        return { item }
    }
}
