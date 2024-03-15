import { PrismaTreatmentsRepository } from '@/repositories/prisma/prisma-treatments-repository'
import { TreatmentUseCase } from '../treatment'
import { PrismaClientsRepository } from '@/repositories/prisma/prisma-clients-repository'
import { PrismaEquipmentsRepository } from '@/repositories/prisma/prisma-equipments-repository'
import { PrismaUsersRepository } from '@/repositories/prisma/prisma-users-repository'




export function MakeTreatmentUseCase() {
    const treatmentsRepository = new PrismaTreatmentsRepository()
    const clientsRepository = new PrismaClientsRepository()
    const equipmentsRepository = new PrismaEquipmentsRepository()
    const usersRepository = new PrismaUsersRepository()
    const treatmentUseCase = new TreatmentUseCase(treatmentsRepository, clientsRepository, equipmentsRepository, usersRepository)
    return treatmentUseCase
}
