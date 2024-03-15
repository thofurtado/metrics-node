import { ClientsRepository } from '@/repositories/clients-repository'
import { EquipmentsRepository } from '@/repositories/equipments-repository'
import { Equipment } from '@prisma/client'
import { ResourceNotFoundError } from './errors/resource-not-found-error'
interface EquipmentUseCaseRequest {
    client_id: string;
    type: string;
    brand?: string;
    identification?: string;
    details?: string
    entry: Date
}

interface EquipmentUseCaseResponse {
    equipment: Equipment
}
export class EquipmentUseCase {

    constructor(
        private equipmentRepository: EquipmentsRepository,
        private clientRepository: ClientsRepository
    ) { }
    async execute({
        type, brand, identification, details, entry, client_id
    }: EquipmentUseCaseRequest): Promise<EquipmentUseCaseResponse> {

        const client = await this.clientRepository.findById(client_id)

        if(!client) {
            throw new ResourceNotFoundError()
        }

        const equipment = await this.equipmentRepository.create({
            type,
            brand: brand || null,
            identification: identification || null,
            details: details || null,
            entry: new Date(entry),
            client_id: client_id
        })

        return {
            equipment
        }
    }
}

