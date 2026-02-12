import { ProductsRepository } from '@/modules/products/repositories/products-repository'
import { Product } from '@prisma/client'
import { ResourceNotFoundError } from '@/errors/resource-not-found-error'

interface GetProductByIdUseCaseRequest {
    id: string
}

interface GetProductByIdUseCaseResponse {
    product: Product & {
        cost: number
    }
}

export class GetProductByIdUseCase {
    constructor(private productsRepository: ProductsRepository) { }

    async execute({
        id
    }: GetProductByIdUseCaseRequest): Promise<GetProductByIdUseCaseResponse> {
        const product = await this.productsRepository.findById(id)

        if (!product) {
            throw new ResourceNotFoundError()
        }

        let totalCost = product.cost ?? 0

        // Explicitly check is_composite logic as requested
        if (product.is_composite) {
            const compositions = (product as any).compositions
            if (compositions && compositions.length > 0) {
                totalCost = 0
                for (const comp of compositions) {
                    if (comp.supply) {
                        totalCost += comp.supply.cost * comp.quantity
                    }
                }
            }
        }

        return {
            product: {
                ...product,
                cost: totalCost
            }
        }
    }
}
