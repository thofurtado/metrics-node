import { PrismaTreatmentsRepository } from '@/repositories/prisma/prisma-treatments-repository'
import { UpdateTreatmentUseCase } from '../update-treatment'


export function MakeUpdateTreatmentUseCase() {
    const treatmentsRepository = new PrismaTreatmentsRepository()
    const registerUseCase = new UpdateTreatmentUseCase(treatmentsRepository)
    return registerUseCase
}
