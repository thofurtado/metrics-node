import { PrismaInteractionsRepository } from '@/modules/clients/repositories/prisma/prisma-interactions-repository'
import { InteractionUseCase } from '@/modules/clients/use-cases/interaction'
import { PrismaUsersRepository } from '@/modules/users/repositories/prisma/prisma-users-repository'
import { PrismaTreatmentsRepository } from '@/modules/treatments/repositories/prisma/prisma-treatments-repository'




export function MakeInteractionUseCase() {
    const interactionsRepository = new PrismaInteractionsRepository()
    const usersRepository = new PrismaUsersRepository()
    const treatmentsRepository = new PrismaTreatmentsRepository()
    const interactionUseCase = new InteractionUseCase(interactionsRepository, usersRepository, treatmentsRepository)
    return interactionUseCase
}
