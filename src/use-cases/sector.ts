import { SectorsRepository } from '@/repositories/sectors-repository'
import { Sector } from '@prisma/client'
import { ThisNameAlreadyExistsError } from './errors/this-name-already-exists-error'
import { InvalidOptionError } from './errors/invalid-option-error'

interface SectorUseCaseRequest {
    name: string;
    budget: number | undefined;
    type: string
}

interface SectorUseCaseResponse {
    sector: Sector
}
export class SectorUseCase {

    constructor(
        private sectorsRepository: SectorsRepository
    ) { }
    async execute({
        name, budget, type
    }: SectorUseCaseRequest): Promise<SectorUseCaseResponse> {

        const sectorWithSameName = await this.sectorsRepository.findByName(name)

        if(sectorWithSameName !== null){
            throw new ThisNameAlreadyExistsError()
        }

        if(type !== 'in' && type !== 'out') {
            throw new InvalidOptionError()
        }

        const sector = await this.sectorsRepository.create({
            name,
            budget,
            type
        })
        return {
            sector
        }
    }
}

