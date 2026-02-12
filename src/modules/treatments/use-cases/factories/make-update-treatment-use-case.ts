import { PrismaTreatmentsRepository } from '@/modules/treatments/repositories/prisma/prisma-treatments-repository'
import { UpdateTreatmentUseCase } from '@/modules/treatments/use-cases/update-treatment'


export function MakeUpdateTreatmentUseCase() {
    const treatmentsRepository = new PrismaTreatmentsRepository()
    const registerUseCase = new UpdateTreatmentUseCase(treatmentsRepository)
    return registerUseCase
}
