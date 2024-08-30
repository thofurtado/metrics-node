import { PrismaTreatmentsRepository } from '@/repositories/prisma/prisma-treatments-repository'
import { GetMonthTreatmentsAmountUseCase } from '../get-month-treatments-amount'

export function makeGetMonthTreatmentsAmountUseCase() {
    const treatmentsRepository = new PrismaTreatmentsRepository()
    const getTreatmentProfileUseCase = new GetMonthTreatmentsAmountUseCase(treatmentsRepository)
    return getTreatmentProfileUseCase
}
