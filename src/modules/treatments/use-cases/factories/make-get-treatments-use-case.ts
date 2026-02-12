
import { PrismaTreatmentsRepository } from '@/modules/treatments/repositories/prisma/prisma-treatments-repository'
import { GetTreatmentsUseCase } from '@/modules/treatments/use-cases/get-treatments'

export function MakeGetTreatmentsUseCase() {
    const treatmentsRepository = new PrismaTreatmentsRepository()
    const getTreatmentUseCase = new GetTreatmentsUseCase(treatmentsRepository)
    return getTreatmentUseCase
}
