import { EquipmentsRepository } from '@/modules/equipments/repositories/equipments-repository'
import { Equipment } from '@prisma/client'

interface UpdateEquipmentTelemetryUseCaseRequest {
  id: string
  telemetry: any
}

interface UpdateEquipmentTelemetryUseCaseResponse {
  equipment: Equipment
}

export class UpdateEquipmentTelemetryUseCase {
  constructor(private equipmentsRepository: EquipmentsRepository) {}

  async execute({
    id,
    telemetry,
  }: UpdateEquipmentTelemetryUseCaseRequest): Promise<UpdateEquipmentTelemetryUseCaseResponse> {
    const equipment = await this.equipmentsRepository.findById(id)

    if (!equipment) {
      throw new Error('Equipment not found')
    }

    const updateData: any = {
      last_telemetry: telemetry,
      last_seen_at: new Date(),
      is_online: true,
    }; if (telemetry?.osInfo?.hostname) { updateData.hostname = telemetry.osInfo.hostname; }; const updatedEquipment = await this.equipmentsRepository.update(id, updateData)

    return {
      equipment: updatedEquipment,
    }
  }
}

