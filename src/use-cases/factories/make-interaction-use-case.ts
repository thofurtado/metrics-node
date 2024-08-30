import { PrismaInteractionsRepository } from '@/repositories/prisma/prisma-interactions-repository'
import { InteractionUseCase } from '../interaction'
import { PrismaUsersRepository } from '@/repositories/prisma/prisma-users-repository'
import { PrismaTreatmentsRepository } from '@/repositories/prisma/prisma-treatments-repository'




export function MakeInteractionUseCase() {
    const interactionsRepository = new PrismaInteractionsRepository()
    const usersRepository = new PrismaUsersRepository()
    const treatmentsRepository = new PrismaTreatmentsRepository()
    const interactionUseCase = new InteractionUseCase(interactionsRepository, usersRepository, treatmentsRepository)
    return interactionUseCase
}
