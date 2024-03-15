import { InteractionsRepository } from '@/repositories/interactions-repository'
import { TreatmentsRepository } from '@/repositories/treatments-repository'
import { UsersRepository } from '@/repositories/users-repository'
import { Interaction } from '@prisma/client'
import { ResourceNotFoundError } from './errors/resource-not-found-error'

interface InteractionUseCaseRequest {
    user_id: string,
    treatment_id: string,
    date: Date,
    description: string
}
interface InteractionUseCaseResponse {
    interaction: Interaction
}
export class InteractionUseCase {

    constructor(
        private interactionsRepository: InteractionsRepository,
        private usersRepository: UsersRepository,
        private treatmentsRepository: TreatmentsRepository
    ) { }
    async execute({
        user_id, treatment_id, date, description
    }: InteractionUseCaseRequest): Promise<InteractionUseCaseResponse> {

        const user = await this.usersRepository.findById(user_id)
        if(!user) {
            throw new ResourceNotFoundError()
        }
        const treatment = await this.treatmentsRepository.findById(treatment_id)
        if(!treatment) {
            throw new ResourceNotFoundError()
        }
        const interaction = await this.interactionsRepository.create({
            user_id,
            treatment_id,
            date,
            description
        })
        return {
            interaction
        }
    }
}

