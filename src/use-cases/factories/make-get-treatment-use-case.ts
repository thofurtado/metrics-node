
import { PrismaTreatmentsRepository } from '@/repositories/prisma/prisma-treatments-repository'
import { GetTreatmentUseCase } from '../get-treatment'

export function MakeGetTreatmentUseCase() {
    const treatmentsRepository = new PrismaTreatmentsRepository()
    const getTreatmentUseCase = new GetTreatmentUseCase(treatmentsRepository)
    return getTreatmentUseCase
}
