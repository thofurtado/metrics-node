import { GetTreatmentDTO } from '@/modules/treatments/repositories/DTO/get-treatments-dto'
import { TreatmentsRepository } from '@/modules/treatments/repositories/treatments-repository'


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
    async execute({ pageIndex = 1, perPage = 6, treatmentId, clientName, status }: Partial<GetTreatmentsUseCaseRequest> = {}): Promise<GetTreatmentDTO | null> {
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

