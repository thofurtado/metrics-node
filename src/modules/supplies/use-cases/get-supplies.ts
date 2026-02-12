import { SuppliesRepository } from '@/repositories/supplies-repository'
import { Supply } from '@prisma/client'

interface GetSuppliesUseCaseRequest {
    page: number
    perPage: number
    query?: string
}

interface GetSuppliesUseCaseResponse {
    supplies: Supply[]
    count: number
}

export class GetSuppliesUseCase {
    constructor(private suppliesRepository: SuppliesRepository) { }

    async execute({
        page,
        perPage,
        query
    }: GetSuppliesUseCaseRequest): Promise<GetSuppliesUseCaseResponse> {
        const { supplies, count } = await this.suppliesRepository.findMany(page, perPage, query)
        return { supplies, count }
    }
}
