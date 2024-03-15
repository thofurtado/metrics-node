import { TreatmentsRepository } from '@/repositories/treatments-repository'
import { Treatment } from '@prisma/client'



interface GetTreatmentsUseCaseResponse {
    treatments: Treatment[] | null
}
export class GetTreatmentsUseCase {

    constructor(
        private treatmentsRepository: TreatmentsRepository
    ) { }
    async execute(): Promise<GetTreatmentsUseCaseResponse> {

        const treatments = await this.treatmentsRepository.findByStatus(false)


        return {
            treatments
        }
    }
}

