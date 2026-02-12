import { PrismaEquipmentsRepository } from '@/modules/equipments/repositories/prisma/prisma-equipments-repository'
import { EquipmentUseCase } from '@/modules/equipments/use-cases/equipment'
import { PrismaClientsRepository } from '@/modules/clients/repositories/prisma/prisma-clients-repository'




export function MakeEquipmentuseCase() {
    const equipmentsRepository = new PrismaEquipmentsRepository()
    const clientsRepository = new PrismaClientsRepository()
    const equipmentUseCase = new EquipmentUseCase(equipmentsRepository, clientsRepository)
    return equipmentUseCase
}
