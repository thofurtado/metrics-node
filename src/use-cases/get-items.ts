import { ItemsRepository } from '@/repositories/items-repository'
import { GetItemsDTO } from '@/repositories/DTO/get-items-dto'
import { ItemType } from '@prisma/client'


interface GetItemsUseCaseRequest {
    page?: number
    limit?: number
    is_active?: boolean
    type?: ItemType
    name?: string
    display_id?: number
    below_min_stock?: boolean
}

export class GetItemsUseCase {

    constructor(
        private itemsRepository: ItemsRepository
    ) { }
    async execute({ page, limit, is_active, type, name, display_id, below_min_stock }: GetItemsUseCaseRequest): Promise<GetItemsDTO | null> {

        const items = await this.itemsRepository.findMany(is_active, type, page, limit, name, display_id, below_min_stock)

        return items
    }
}
