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
            const quantity = treatmentItem.quantity
            const salesValue = treatmentItem.salesValue ?? 0
            const discount = treatmentItem.discount ?? 0

            const totalValueToRemove = Number(((quantity * salesValue) - discount).toFixed(2))

            await this.treatmentsRepository.changeValue(treatmentItem.treatment_id, totalValueToRemove, false)
            await this.treatmentItemsRepository.remove(id)
        }
    }
}

