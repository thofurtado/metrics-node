import { ProductsRepository } from '@/repositories/products-repository'
import { SuppliesRepository } from '@/repositories/supplies-repository'
import { Product } from '@prisma/client'
import { ResourceNotFoundError } from '../errors/resource-not-found-error'

interface UpdateProductUseCaseRequest {
    id: string
    name?: string
    description?: string | null
    price?: number
    stock?: number | null
    min_stock?: number | null
    barcode?: string | null
    ncm?: string | null
    is_composite?: boolean
    display_id?: number | null
    category?: string | null
    active?: boolean | null
    cost?: number | null
    compositions?: {
        supply_id: string
        quantity: number
    }[]
}

interface UpdateProductUseCaseResponse {
    product: Product
}

export class UpdateProductUseCase {
    constructor(
        private productsRepository: ProductsRepository,
        private suppliesRepository: SuppliesRepository
    ) { }

    async execute(data: UpdateProductUseCaseRequest): Promise<UpdateProductUseCaseResponse> {
        const product = await this.productsRepository.findById(data.id)

        if (!product) {
            throw new ResourceNotFoundError()
        }

        let totalCost = data.cost ?? product.cost

        const finalIsComposite = data.is_composite !== undefined ? data.is_composite : product.is_composite

        if (finalIsComposite) {
            const comps = data.compositions || (product as any).compositions
            if (comps && comps.length > 0) {
                totalCost = 0
                for (const comp of comps) {
                    const supply = await this.suppliesRepository.findById(comp.supply_id)
                    if (supply) {
                        totalCost += supply.cost * comp.quantity
                    }
                }
            }
        }

        // Fix: Map category to category_id and remove 'category' to prevent errors
        const { category, ...restData } = data
        const updateData: any = {
            ...product,
            ...restData,
            cost: totalCost,
        }

        if (category) {
            updateData.category_id = category
        }

        // Ensure we don't pass 'category' string field to Prisma update implicitly
        // The repository .save method might clean it up, but it's safer to handle here 
        // especially if we are re-mapping.

        // Note: The previous logic used Object.assign like spread, effectively overwriting.
        // We clean undefined values from data to avoid overwriting existing non-nulls with nulls if that was unintended,
        // but here the interface allows nulls for clearing fields.
        // However, 'undefined' usually means 'do not update'.

        Object.keys(restData).forEach(key => {
            if ((restData as any)[key] === undefined) {
                delete (updateData as any)[key]
            }
        })

        // Special clean up for the extracted category if it was undefined in restData, 
        // (already handled by extraction).

        const updatedProduct = await this.productsRepository.save(updateData)

        return { product: updatedProduct }
    }
}
