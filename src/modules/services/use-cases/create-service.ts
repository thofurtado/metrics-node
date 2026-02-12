import { ServicesRepository } from '@/modules/services/repositories/services-repository'
import { Service } from '@prisma/client'
import { ThisNameAlreadyExistsError } from '@/errors/this-name-already-exists-error'
import { DisplayIdAlreadyExistsError } from '@/errors/display-id-already-exists-error'

interface CreateServiceUseCaseRequest {
    name: string
    description?: string
    price: number
    estimated_time?: string
    display_id?: number
    category?: string
    active?: boolean
}

interface CreateServiceUseCaseResponse {
    service: Service
}

export class CreateServiceUseCase {
    constructor(private servicesRepository: ServicesRepository) { }

    async execute({
        name,
        description,
        price,
        estimated_time,
        display_id,
        category,
        active
    }: CreateServiceUseCaseRequest): Promise<CreateServiceUseCaseResponse> {
        const serviceWithSameName = await this.servicesRepository.findByName(name)
        if (serviceWithSameName) {
            throw new ThisNameAlreadyExistsError()
        }

        let finalDisplayId = display_id
        if (finalDisplayId) {
            const conflict = await this.servicesRepository.findByDisplayId(finalDisplayId)
            if (conflict) {
                throw new DisplayIdAlreadyExistsError()
            }
        } else {
            finalDisplayId = await this.servicesRepository.findNextAvailableDisplayId()
        }

        const service = await this.servicesRepository.create({
            name,
            description,
            price,
            estimated_time,
            display_id: finalDisplayId,
            category,
            active: active ?? true
        })

        return { service }
    }
}
