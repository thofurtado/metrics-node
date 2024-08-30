import { TreatmentsRepository } from '@/repositories/treatments-repository'
import { Treatment } from '@prisma/client'


interface UpdateTreatmentUseCaseRequest {
    id: string,
    opening_date?: Date,
    ending_date?: Date,
    contact?: string,
    user_id?: string,
    client_id?: string,
    equipment_id?: string,
    request?: string,
    status?: string,
    amount?: number,
    observations?: string,
}

interface UpdateTreatmentUseCaseResponse {
    treatment: Treatment
}
export class UpdateTreatmentUseCase {

    constructor(
        private treatmentsRepository: TreatmentsRepository
    ) { }
    async execute({
        id,
        opening_date, ending_date, contact, user_id, client_id, equipment_id, request,status, observations
    }: UpdateTreatmentUseCaseRequest): Promise<UpdateTreatmentUseCaseResponse> {

        const treatment = await this.treatmentsRepository.update(id, {
            opening_date, ending_date, contact, user_id, client_id, equipment_id, request,status, observations
        })

        return {
            treatment
        }
    }
}

