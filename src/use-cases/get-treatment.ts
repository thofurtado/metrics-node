import { TreatmentsRepository } from '@/repositories/treatments-repository'
import { Treatment } from '@prisma/client'


interface GetTreatmentUseCaseRequest {
    treatmentId: string,
}


export class GetTreatmentUseCase {

    constructor(
        private treatmentsRepository: TreatmentsRepository
    ) { }
    async execute({treatmentId}:GetTreatmentUseCaseRequest): Promise<Treatment | null> {

        const treatment = await this.treatmentsRepository.findById(treatmentId)
        return treatment
    }
}

