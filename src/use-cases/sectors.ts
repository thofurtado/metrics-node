import { SectorsRepository } from '@/repositories/sectors-repository'
import { Sector } from '@prisma/client'
import { ThisNameAlreadyExistsError } from './errors/this-name-already-exists-error'

interface SectorUseCaseRequest {
    name: string;
    budget: number | undefined;
}

interface SectorUseCaseResponse {
    sector: Sector
}
export class SectorUseCase {

    constructor(
        private sectorsRepository: SectorsRepository
    ) { }
    async execute({
        name, budget
    }: SectorUseCaseRequest): Promise<SectorUseCaseResponse> {

        const sectorWithSameName = await this.sectorsRepository.findByName(name)

        if(sectorWithSameName !== null){
            throw new ThisNameAlreadyExistsError()
        }

        const sector = await this.sectorsRepository.create({
            name,
            budget
        })
        return {
            sector
        }
    }
}

