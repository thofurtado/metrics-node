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
    async execute({ page = 1, limit = 10, is_active, type, name, display_id, below_min_stock }: Partial<GetItemsUseCaseRequest> = {}): Promise<GetItemsDTO | null> {

        // Cast type to match repository signature safe
        const result = await this.itemsRepository.findMany(is_active, type as any, page, limit, name, display_id, below_min_stock)

        if (result) {
            result.items = result.items.map((item: any) => {
                // Ensure product structure exists
                if (item.type === 'PRODUCT' && item.product) {

                    // Calculate cost for Composite Products
                    if (item.product.is_composite) {
                        const compositions = item.product.compositions || []
                        const calculatedCost = compositions.reduce((acc: number, comp: any) => {
                            const supplyCost = comp.supply?.cost || 0
                            return acc + (supplyCost * comp.quantity)
                        }, 0)

                        item.product.cost = calculatedCost
                    } else {
                        // For non-composite, ensure cost is defined (default to 0 if null)
                        if (item.product.cost === null || item.product.cost === undefined) {
                            item.product.cost = 0
                        }
                    }
                    // DEBUG LOG
                    console.log(`[USECASE] Processed Item ${item.id} (${item.name}): Composite=${item.product.is_composite}, Cost=${item.product.cost}`)
                }
                return item
            })
        }

        return result
    }
}
