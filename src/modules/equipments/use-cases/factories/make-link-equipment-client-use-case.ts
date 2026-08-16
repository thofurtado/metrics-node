import { PrismaEquipmentsRepository } from '@/modules/equipments/repositories/prisma/prisma-equipments-repository'
import { LinkEquipmentClientUseCase } from '../link-equipment-client'

export function makeLinkEquipmentClientUseCase() {
  const equipmentsRepository = new PrismaEquipmentsRepository()
  const useCase = new LinkEquipmentClientUseCase(equipmentsRepository)

  return useCase
}
