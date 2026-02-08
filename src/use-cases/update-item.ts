import { ItemsRepository } from '@/repositories/items-repository'
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
    stock?: number | null
    is_composite?: boolean
    compositions?: {
        supply_id: string
        quantity: number
    }[]
}

interface UpdateItemUseCaseResponse {
    item: any
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
            id: data.id,
            name: data.name,
            description: data.description,
            category: data.category,
            active: data.active,
        }

        if (type === 'PRODUCT') {
            const productUpdate: any = {
                price: data.price,
                min_stock: data.min_stock,
                stock: data.stock, // Added stock
                barcode: data.barcode,
                ncm: data.ncm,
                display_id: data.display_id,
                cost: data.cost,
            }

            // Logic for Composable Transition
            if (data.is_composite === false) {
                // Turning OFF composition -> Clear relations
                productUpdate.is_composite = false
                productUpdate.compositions = {
                    deleteMany: {}
                }
            } else if (data.is_composite === true || (data.is_composite === undefined && (existentItem as any).product?.is_composite)) {
                // Turning ON or Updating composition
                if (data.is_composite === true) productUpdate.is_composite = true

                if (data.compositions) {
                    productUpdate.compositions = {
                        deleteMany: {},
                        create: data.compositions.map(comp => ({
                            supply_id: comp.supply_id,
                            quantity: comp.quantity
                        }))
                    }
                }
            }

            payload.product = {
                update: productUpdate
            }
        } else if (type === 'SERVICE') {
            payload.service = {
                update: {
                    price: data.price,
                    estimated_time: data.estimated_time,
                    display_id: data.display_id
                }
            }
        } else if (type === 'SUPPLY') {
            payload.supply = {
                update: {
                    cost: data.cost,
                    unit: data.unit,
                    // Supply may also have stock update?
                    // Currently stock for supply goes via changeStock or here?
                    // Let's add it if provided
                    stock: data.stock
                }
            }
        }

        const item = await this.itemsRepository.update(payload)
        return { item }
    }
}
