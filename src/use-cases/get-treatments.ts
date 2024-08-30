import { GetTreatmentDTO } from '@/repositories/DTO/get-treatments-dto'
import { TreatmentsRepository } from '@/repositories/treatments-repository'


interface GetTreatmentsUseCaseRequest {
    pageIndex: number,
    perPage?: number
    treatmentId?: string,
    clientName?:string,
    status?: string
}


export class GetTreatmentsUseCase {

    constructor(
        private treatmentsRepository: TreatmentsRepository
    ) { }
    async execute({pageIndex, perPage, treatmentId, clientName, status}:GetTreatmentsUseCaseRequest): Promise<GetTreatmentDTO | null> {

        if(!perPage)
            perPage = 6
        const treatments = await this.treatmentsRepository.findByActive(pageIndex, perPage, treatmentId, clientName, status)
        return {
            treatments,
        }
    }
}

