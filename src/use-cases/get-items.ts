import { ItemsRepository } from '@/repositories/items-repository'
import { GetItemsDTO } from '@/repositories/DTO/get-items-dto'
import { ItemType } from '@prisma/client'


interface GetItemsUseCaseRequest {
    page?: number
    limit?: number
    is_active?: boolean
    type?: ItemType | ItemType[]
    name?: string
    display_id?: number
    below_min_stock?: boolean
}

export class GetItemsUseCase {

    constructor(
        private itemsRepository: ItemsRepository
    ) { }
    async execute({ page, limit, is_active, type, name, display_id, below_min_stock }: GetItemsUseCaseRequest): Promise<GetItemsDTO | null> {

        const result = await this.itemsRepository.findMany(is_active, type, page, limit, name, display_id, below_min_stock)

        if (result) {
            result.items = result.items.map((item: any) => {
                if (item.type === ItemType.PRODUCT && item.product?.is_composite) {
                    let totalCost = 0
                    const compositions = item.product.compositions
                    if (compositions && compositions.length > 0) {
                        for (const comp of compositions) {
                            if (comp.supply) {
                                totalCost += comp.supply.cost * comp.quantity
                            }
                        }
                    }
                    item.product.cost = totalCost
                }
                return item
            })
        }

        return result
    }
}
