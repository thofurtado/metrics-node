import { ServicesRepository } from '../repositories/services-repository'
import { Service } from '@prisma/client'

interface GetServicesUseCaseRequest {
    page: number
    limit: number
    query?: string
    display_id?: number
    is_active?: boolean
}

interface GetServicesUseCaseResponse {
    items: Service[]
    meta: {
        totalCount: number
        pageIndex: number
        perPage: number
    }
}

export class GetServicesUseCase {
    constructor(private servicesRepository: ServicesRepository) { }

    async execute({
        page,
        limit,
        query,
        display_id,
        is_active
    }: GetServicesUseCaseRequest): Promise<GetServicesUseCaseResponse> {
        const { items, total } = await this.servicesRepository.findMany(
            page,
            limit,
            query,
            display_id,
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
