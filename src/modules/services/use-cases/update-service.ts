import { ServicesRepository } from '@/modules/services/repositories/services-repository'
import { Service } from '@prisma/client'
import { ResourceNotFoundError } from '@/errors/resource-not-found-error'

interface UpdateServiceUseCaseRequest {
    id: string
    name?: string
    description?: string | null
    price?: number
    estimated_time?: string | null
    display_id?: number
    category?: string | null
    active?: boolean
}

interface UpdateServiceUseCaseResponse {
    service: Service
}

export class UpdateServiceUseCase {
    constructor(private servicesRepository: ServicesRepository) { }

    async execute(data: UpdateServiceUseCaseRequest): Promise<UpdateServiceUseCaseResponse> {
        const service = await this.servicesRepository.findById(data.id)

        if (!service) {
            throw new ResourceNotFoundError()
        }

        const updatedService = await this.servicesRepository.save({
            ...service,
            ...data,
        })

        return { service: updatedService }
    }
}
