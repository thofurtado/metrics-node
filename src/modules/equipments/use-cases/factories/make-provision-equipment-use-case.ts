import { PrismaEquipmentsRepository } from '@/modules/equipments/repositories/prisma/prisma-equipments-repository'
import { ProvisionEquipmentUseCase } from '../provision-equipment'

export function makeProvisionEquipmentUseCase() {
  const equipmentsRepository = new PrismaEquipmentsRepository()
  const useCase = new ProvisionEquipmentUseCase(equipmentsRepository)

  return useCase
}
