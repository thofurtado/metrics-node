import { PrismaEquipmentsRepository } from '@/modules/equipments/repositories/prisma/prisma-equipments-repository'
import { UpdateEquipmentTelemetryUseCase } from '../update-equipment-telemetry'

export function makeUpdateEquipmentTelemetryUseCase() {
  const equipmentsRepository = new PrismaEquipmentsRepository()
  const useCase = new UpdateEquipmentTelemetryUseCase(equipmentsRepository)

  return useCase
}
