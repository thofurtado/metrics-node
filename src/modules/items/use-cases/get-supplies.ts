import { SuppliesRepository } from '../repositories/supplies-repository'
import { Supply } from '@prisma/client'

interface GetSuppliesUseCaseRequest {
    page: number
    limit: number
    query?: string
    is_active?: boolean
}

interface GetSuppliesUseCaseResponse {
    items: Supply[]
    meta: {
        totalCount: number
        pageIndex: number
        perPage: number
    }
}

export class GetSuppliesUseCase {
    constructor(private suppliesRepository: SuppliesRepository) { }

    async execute({
        page,
        limit,
        query,
        is_active
    }: GetSuppliesUseCaseRequest): Promise<GetSuppliesUseCaseResponse> {
        const { items, total } = await this.suppliesRepository.findMany(
            page,
            limit,
            query,
            is_active
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
