import { ProductsRepository } from '../repositories/products-repository'
import { Product } from '@prisma/client'

interface GetProductsUseCaseRequest {
    page: number
    limit: number
    query?: string
    display_id?: number
    is_active?: boolean
    below_min_stock?: boolean
}

interface GetProductsUseCaseResponse {
    items: Product[]
    meta: {
        totalCount: number
        pageIndex: number
        perPage: number
    }
}

export class GetProductsUseCase {
    constructor(private productsRepository: ProductsRepository) { }

    async execute({
        page,
        limit,
        query,
        display_id,
        is_active,
        below_min_stock
    }: GetProductsUseCaseRequest): Promise<GetProductsUseCaseResponse> {
        const { items, total } = await this.productsRepository.findMany(
            page,
            limit,
            query,
            display_id,
            is_active,
            below_min_stock
        )

        return {
            items,
            meta: {
                totalCount: total,
                pageIndex: page,
                perPage: limit
            }
        }
    }
}
