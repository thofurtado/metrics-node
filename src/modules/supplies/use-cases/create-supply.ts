import { SuppliesRepository } from '@/repositories/supplies-repository'
import { Supply } from '@prisma/client'
import { ThisNameAlreadyExistsError } from '@/errors/this-name-already-exists-error'

interface CreateSupplyUseCaseRequest {
    name: string
    description?: string
    cost: number
    stock?: number
    unit?: string
    category?: string
    active?: boolean
}

interface CreateSupplyUseCaseResponse {
    supply: Supply
}

export class CreateSupplyUseCase {
    constructor(private suppliesRepository: SuppliesRepository) { }

    async execute({
        name,
        description,
        cost,
        stock,
        unit,
        category,
        active
    }: CreateSupplyUseCaseRequest): Promise<CreateSupplyUseCaseResponse> {
        const supplyWithSameName = await this.suppliesRepository.findByName(name)
        if (supplyWithSameName) {
            throw new ThisNameAlreadyExistsError()
        }

        const supply = await this.suppliesRepository.create({
            name,
            description,
            cost,
            stock: stock ?? 0,
            unit: unit ?? 'UN',
            category,
            active: active ?? true
        })

        return { supply }
    }
}
