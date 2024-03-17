
import { PrismaTreatmentsRepository } from '@/repositories/prisma/prisma-treatments-repository'
import { GetTreatmentsUseCase } from '../get-treatments'

export function MakeGetTreatmentsUseCase() {
    const treatmentsRepository = new PrismaTreatmentsRepository()
    const getTreatmentUseCase = new GetTreatmentsUseCase(treatmentsRepository)
    return getTreatmentUseCase
}
