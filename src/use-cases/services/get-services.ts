import { ServicesRepository } from '@/repositories/services-repository'
import { Service } from '@prisma/client'

interface GetServicesUseCaseRequest {
    page: number
    perPage: number
    query?: string
    active?: boolean
}

interface GetServicesUseCaseResponse {
    services: Service[]
    count: number
}

export class GetServicesUseCase {
    constructor(private servicesRepository: ServicesRepository) { }

    async execute({
        page,
        perPage,
        query,
        active
    }: GetServicesUseCaseRequest): Promise<GetServicesUseCaseResponse> {
        const { services, count } = await this.servicesRepository.findMany(page, perPage, query, active)
        return { services, count }
    }
}
