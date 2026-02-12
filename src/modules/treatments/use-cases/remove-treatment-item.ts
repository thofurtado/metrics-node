import { TreatmentItemsRepository } from '@/modules/treatments/repositories/treatmentItems-repository'
import { ResourceNotFoundError } from '@/errors/resource-not-found-error'
import { TreatmentsRepository } from '@/modules/treatments/repositories/treatments-repository'

interface RemoveTreatmentItemUseCaseRequest {
    id: string
}
export class RemoveTreatmentItemUseCase {

    constructor(
        private treatmentItemsRepository: TreatmentItemsRepository,
        private treatmentsRepository: TreatmentsRepository
    ) { }
    async execute({
        id
    }: RemoveTreatmentItemUseCaseRequest): Promise<void> {

        const treatmentItem = await this.treatmentItemsRepository.findById(id)
        if (!treatmentItem) {
            throw new ResourceNotFoundError()
        } else {

            await this.treatmentItemsRepository.remove(id)
        }
    }
}

