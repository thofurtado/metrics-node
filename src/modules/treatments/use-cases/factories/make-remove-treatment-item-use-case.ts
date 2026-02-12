import { PrismaTreatmentItemsRepository } from '@/modules/treatments/repositories/prisma/prisma-treatment-items-repository'
import { PrismaTreatmentsRepository } from '@/modules/treatments/repositories/prisma/prisma-treatments-repository'
import { RemoveTreatmentItemUseCase } from '@/modules/treatments/use-cases/remove-treatment-item'




export function MakeRemoveTreatmentItemUseCase() {
    const treatmentItemsRepository = new PrismaTreatmentItemsRepository()
    const treatmentsRepository = new PrismaTreatmentsRepository()
    const treatmentItemUseCase = new RemoveTreatmentItemUseCase(
        treatmentItemsRepository,
        treatmentsRepository,
    )
    return treatmentItemUseCase
}
