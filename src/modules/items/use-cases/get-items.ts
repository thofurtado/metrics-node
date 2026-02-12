import { ItemsRepository } from '@/modules/items/repositories/items-repository'
import { GetItemsDTO } from '@/modules/items/repositories/DTO/get-items-dto'

interface GetItemsUseCaseRequest {
    page?: number
    limit?: number
    is_active?: boolean
    type?: string | string[]
    name?: string
    display_id?: number
    below_min_stock?: boolean
}

export class GetItemsUseCase {

    constructor(
        private itemsRepository: ItemsRepository
    ) { }
    async execute({ page, limit, is_active, type, name, display_id, below_min_stock }: GetItemsUseCaseRequest): Promise<GetItemsDTO | null> {

        // @ts-ignore
        const result = await this.itemsRepository.findMany(is_active, type, page, limit, name, display_id, below_min_stock)

        if (result) {
            result.items = result.items.map((item: any) => {
                // Calculate cost for Composite Products
                if (item.type === 'PRODUCT' && item.product?.is_composite) {
                    const compositions = item.product.compositions || []
                    const calculatedCost = compositions.reduce((acc: number, comp: any) => {
                        const supplyCost = comp.supply?.cost || 0
                        return acc + (supplyCost * comp.quantity)
                    }, 0)

                    // Override the cost with the calculated sum of ingredients
                    // Only if we actually have compositions, otherwise functionality might stay 0 or keep original cost?
                    // User says: "O custo deve ser a SOMA". If no compositions conform, cost is 0.
                    item.product.cost = calculatedCost
                }
                return item
            })
        }

        return result
    }
}
