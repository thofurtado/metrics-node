import { EquipmentsRepository } from '@/modules/equipments/repositories/equipments-repository'
import { Equipment } from '@prisma/client'

interface LinkEquipmentClientUseCaseRequest {
  id: string
  client_id: string
}

interface LinkEquipmentClientUseCaseResponse {
  equipment: Equipment
}

export class LinkEquipmentClientUseCase {
  constructor(private equipmentsRepository: EquipmentsRepository) {}

  async execute({
    id,
    client_id,
  }: LinkEquipmentClientUseCaseRequest): Promise<LinkEquipmentClientUseCaseResponse> {
    const equipment = await this.equipmentsRepository.findById(id)

    if (!equipment) {
      throw new Error('Equipment not found')
    }

    const updatedEquipment = await this.equipmentsRepository.update(id, {
      client_id,
    })

    return {
      equipment: updatedEquipment,
    }
  }
}
