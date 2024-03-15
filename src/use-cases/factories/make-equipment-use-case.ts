import { PrismaEquipmentsRepository } from '@/repositories/prisma/prisma-equipments-repository'
import { EquipmentUseCase } from '../equipment'
import { PrismaClientsRepository } from '@/repositories/prisma/prisma-clients-repository'




export function MakeEquipmentuseCase() {
    const equipmentsRepository = new PrismaEquipmentsRepository()
    const clientsRepository = new PrismaClientsRepository()
    const equipmentUseCase = new EquipmentUseCase(equipmentsRepository, clientsRepository)
    return equipmentUseCase
}
