
import { PrismaTreatmentsRepository } from '@/modules/treatments/repositories/prisma/prisma-treatments-repository'
import { GetTreatmentUseCase } from '@/modules/treatments/use-cases/get-treatment'

export function MakeGetTreatmentUseCase() {
    const treatmentsRepository = new PrismaTreatmentsRepository()
    const getTreatmentUseCase = new GetTreatmentUseCase(treatmentsRepository)
    return getTreatmentUseCase
}
