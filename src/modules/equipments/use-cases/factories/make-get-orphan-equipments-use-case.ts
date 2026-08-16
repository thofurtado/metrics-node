import { PrismaEquipmentsRepository } from '@/modules/equipments/repositories/prisma/prisma-equipments-repository'
import { GetOrphanEquipmentsUseCase } from '../get-orphan-equipments'

export function makeGetOrphanEquipmentsUseCase() {
  const equipmentsRepository = new PrismaEquipmentsRepository()
  const useCase = new GetOrphanEquipmentsUseCase(equipmentsRepository)

  return useCase
}
