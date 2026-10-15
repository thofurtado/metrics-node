import { PrismaTreatmentsRepository } from '@/modules/treatments/repositories/prisma/prisma-treatments-repository'
import { UpdateTreatmentUseCase } from '@/modules/treatments/use-cases/update-treatment'
import { MakeFinishTreatmentUseCase } from '@/modules/treatments/use-cases/factories/make-finish-treatment-use-case'
import { MakeReopenTreatmentUseCase } from '@/modules/treatments/use-cases/factories/make-reopen-treatment-use-case'


export function MakeUpdateTreatmentUseCase() {
    const treatmentsRepository = new PrismaTreatmentsRepository()
    // Fase 1 do Mergulho (16:A2): entrar ou sair de "finalizada" passa pelo fechamento e pela reabertura.
    const registerUseCase = new UpdateTreatmentUseCase(
        treatmentsRepository,
        MakeFinishTreatmentUseCase(),
        MakeReopenTreatmentUseCase(),
    )
    return registerUseCase
}
