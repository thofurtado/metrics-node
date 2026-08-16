import { EquipmentsRepository } from '@/modules/equipments/repositories/equipments-repository'
import { Equipment } from '@prisma/client'

interface ProvisionEquipmentUseCaseRequest {
  identification: string
  type: string
  hostname: string
}

interface ProvisionEquipmentUseCaseResponse {
  equipment: Equipment
}

export class ProvisionEquipmentUseCase {
  constructor(private equipmentsRepository: EquipmentsRepository) {}

  async execute({
    identification,
    type,
    hostname,
  }: ProvisionEquipmentUseCaseRequest): Promise<ProvisionEquipmentUseCaseResponse> {
    const existingEquipments = await this.equipmentsRepository.findMany(
      undefined,
      undefined,
      identification,
    )

    if (existingEquipments && existingEquipments.length > 0) {
      // Já existe, apenas retorna
      return {
        equipment: existingEquipments[0],
      }
    }

    // Cria um novo órfão
    const equipment = await this.equipmentsRepository.create({
      identification,
      type,
      details: hostname,
      is_online: true,
      last_seen_at: new Date(),
    })

    return {
      equipment,
    }
  }
}
