import { PrismaTreatmentItemsRepository } from '@/repositories/prisma/prisma-treatment-items-repository'
import { PrismaTreatmentsRepository } from '@/repositories/prisma/prisma-treatments-repository'
import { RemoveTreatmentItemUseCase } from '../remove-treatment-item'




export function MakeRemoveTreatmentItemUseCase() {
    const treatmentItemsRepository = new PrismaTreatmentItemsRepository()
    const treatmentsRepository = new PrismaTreatmentsRepository()
    const treatmentItemUseCase = new RemoveTreatmentItemUseCase(
        treatmentItemsRepository,
        treatmentsRepository,
    )
    return treatmentItemUseCase
}
