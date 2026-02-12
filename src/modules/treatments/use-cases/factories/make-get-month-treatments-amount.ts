import { PrismaTreatmentsRepository } from '@/modules/treatments/repositories/prisma/prisma-treatments-repository'
import { GetMonthTreatmentsAmountUseCase } from '@/modules/treatments/use-cases/get-month-treatments-amount'

export function makeGetMonthTreatmentsAmountUseCase() {
    const treatmentsRepository = new PrismaTreatmentsRepository()
    const getTreatmentProfileUseCase = new GetMonthTreatmentsAmountUseCase(treatmentsRepository)
    return getTreatmentProfileUseCase
}
