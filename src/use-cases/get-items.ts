import { ItemsRepository } from '@/repositories/items-repository'
import { GetItemsDTO } from '@/repositories/DTO/get-items-dto'


interface GetItemsUseCaseRequest {
    page?: number
    limit?: number
    is_active?: boolean
    is_product?: boolean
    name?: string
    display_id?: number
    below_min_stock?: boolean
}

interface GetItemsUseCaseResponse {
    items: GetItemsDTO | null // Or just return GetItemsDTO directly? The controller expects {items: ...}. 
    // The previous implementation returned object with items property.
    // The repository returns GetItemsDTO which has items property AND meta property.
    // If I return GetItemsDTO inside items property, it will be { items: { items: [], meta: ... } }. That's confusing.
    // Let's change GetItemsUseCaseResponse to match what the controller expects or what makes sense.
    // Ideally it should return `GetItemsDTO`.
    // But let's look at the controller.
}

export class GetItemsUseCase {

    constructor(
        private itemsRepository: ItemsRepository
    ) { }
    async execute({ page, limit, is_active, is_product, name, display_id, below_min_stock }: GetItemsUseCaseRequest): Promise<GetItemsDTO | null> {

        const items = await this.itemsRepository.findMany(is_active, is_product, page, limit, name, display_id, below_min_stock)

        return items
    }
}
