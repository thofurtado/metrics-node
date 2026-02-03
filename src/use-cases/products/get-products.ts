import { ProductsRepository } from '@/repositories/products-repository'
import { Product } from '@prisma/client'

interface GetProductsUseCaseRequest {
    page: number
    perPage: number
    query?: string
    active?: boolean
}

interface GetProductsUseCaseResponse {
    products: Product[]
    count: number
}

export class GetProductsUseCase {
    constructor(private productsRepository: ProductsRepository) { }

    async execute({
        page,
        perPage,
        query,
        active
    }: GetProductsUseCaseRequest): Promise<GetProductsUseCaseResponse> {
        const { products, count } = await this.productsRepository.findMany(page, perPage, query, active)

        const productsWithCost = products.map(product => {
            let totalCost = product.cost ?? 0
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
                ...product,
                cost: totalCost
            }
        })

        return { products: productsWithCost, count }
    }
}
