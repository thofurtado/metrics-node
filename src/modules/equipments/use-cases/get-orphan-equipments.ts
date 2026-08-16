import { EquipmentsRepository } from '@/modules/equipments/repositories/equipments-repository'
import { Equipment } from '@prisma/client'

interface GetOrphanEquipmentsUseCaseResponse {
  equipments: Equipment[]
}

export class GetOrphanEquipmentsUseCase {
  constructor(private equipmentsRepository: EquipmentsRepository) {}

  async execute(): Promise<GetOrphanEquipmentsUseCaseResponse> {
    const equipments = await this.equipmentsRepository.findOrphans()

    return {
      equipments,
    }
  }
}
