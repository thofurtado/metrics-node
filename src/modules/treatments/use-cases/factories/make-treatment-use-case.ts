import { PrismaTreatmentsRepository } from '@/modules/treatments/repositories/prisma/prisma-treatments-repository'
import { TreatmentUseCase } from '@/modules/treatments/use-cases/treatment'
import { PrismaClientsRepository } from '@/modules/clients/repositories/prisma/prisma-clients-repository'
import { PrismaEquipmentsRepository } from '@/modules/equipments/repositories/prisma/prisma-equipments-repository'
import { PrismaUsersRepository } from '@/modules/users/repositories/prisma/prisma-users-repository'




export function MakeTreatmentUseCase() {
    const treatmentsRepository = new PrismaTreatmentsRepository()
    const clientsRepository = new PrismaClientsRepository()
    const equipmentsRepository = new PrismaEquipmentsRepository()
    const usersRepository = new PrismaUsersRepository()
    const treatmentUseCase = new TreatmentUseCase(treatmentsRepository, clientsRepository, equipmentsRepository, usersRepository)
    return treatmentUseCase
}
