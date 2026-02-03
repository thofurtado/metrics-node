import { SuppliesRepository } from '@/repositories/supplies-repository'
import { ResourceNotFoundError } from '../errors/resource-not-found-error'

interface DeleteSupplyUseCaseRequest {
    id: string
}

export class DeleteSupplyUseCase {
    constructor(private suppliesRepository: SuppliesRepository) { }

    async execute({ id }: DeleteSupplyUseCaseRequest): Promise<void> {
        const supply = await this.suppliesRepository.findById(id)
        if (!supply) {
            throw new ResourceNotFoundError()
        }
        await this.suppliesRepository.delete(id)
    }
}
