import { GetTreatmentDTO } from '@/repositories/DTO/get-treatments-dto'
import { TreatmentsRepository } from '@/repositories/treatments-repository'


interface GetTreatmentsUseCaseRequest {
    pageIndex: number,
    perPage?: number
    treatmentId?: string,
    clientName?: string,
    status?: string
}


export class GetTreatmentsUseCase {

    constructor(
        private treatmentsRepository: TreatmentsRepository
    ) { }
    async execute({ pageIndex, perPage, treatmentId, clientName, status }: GetTreatmentsUseCaseRequest): Promise<GetTreatmentDTO | null> {
        if (!perPage)
            perPage = 6

        try {
            const result = await this.treatmentsRepository.findByActive(pageIndex, perPage, treatmentId, clientName, status)
            return result
        } catch (error) {
            console.error('[GetTreatmentsUseCase] Error executing repository query:', error)
            return null
        }
    }
}

