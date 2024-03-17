import { TreatmentsRepository } from '@/repositories/treatments-repository'
import { Treatment } from '@prisma/client'
import { ResourceNotFoundError } from './errors/resource-not-found-error'
import { ClientsRepository } from '@/repositories/clients-repository'
import { EquipmentsRepository } from '@/repositories/equipments-repository'
import { UsersRepository } from '@/repositories/users-repository'

interface TreatmentUseCaseRequest {
    opening_date?: Date,
    ending_date?: Date,
    contact?: string,
    user_id?: string,
    client_id?: string,
    equipment_id?: string,
    request: string,
    finished?: boolean,
    amount?: number,
    observations?: string
}
interface TreatmentUseCaseResponse {
    treatment: Treatment
}
export class TreatmentUseCase {

    constructor(
        private treatmentsRepository: TreatmentsRepository,
        private clientsRepository: ClientsRepository,
        private equipmentsRepository: EquipmentsRepository,
        private usersRepository: UsersRepository
    ) { }
    async execute({
        opening_date, contact, client_id, equipment_id, user_id,request, finished, amount, observations, ending_date
    }: TreatmentUseCaseRequest): Promise<TreatmentUseCaseResponse> {
        let user
        if (user_id) {
            user = await this.usersRepository.findById(user_id)
            if (!user)
                throw new ResourceNotFoundError()
        }
        let client
        if (client_id) {
            client = await this.clientsRepository.findById(client_id)
            if (!client)
                throw new ResourceNotFoundError()
        }
        let equipment
        if (equipment_id){
            equipment = await this.equipmentsRepository.findById(equipment_id)
            if (!equipment)
                throw new ResourceNotFoundError()
        }

        const treatment = await this.treatmentsRepository.create({
            opening_date, contact, client_id, equipment_id, request, finished, amount, observations, ending_date
        })
        return {
            treatment
        }
    }
}

