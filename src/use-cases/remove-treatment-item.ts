import { TreatmentItemsRepository } from '@/repositories/treatmentItems-repository'
import { ResourceNotFoundError } from './errors/resource-not-found-error'
import { TreatmentsRepository } from '@/repositories/treatments-repository'

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
            console.log(treatmentItem.salesValue)
            await this.treatmentsRepository.changeValue(treatmentItem.treatment_id, treatmentItem.salesValue ? treatmentItem.salesValue * treatmentItem.quantity : 0, false)
            await this.treatmentItemsRepository.remove(id)
        }
    }
}

