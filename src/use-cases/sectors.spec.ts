import {expect, describe, it,beforeEach} from 'vitest'
import { InMemorySectorsRepository } from '@/repositories/in-memory/in-memory-sectors-repository'
import { SectorUseCase } from './sectors'
import { ThisNameAlreadyExistsError } from './errors/this-name-already-exists-error'




let sectorsRepository: InMemorySectorsRepository
let sectorUseCase: SectorUseCase


describe('Sector Use Case', () => {
    beforeEach(() => {

        sectorsRepository = new InMemorySectorsRepository()

        sectorUseCase = new SectorUseCase(sectorsRepository)
    })
    it('should be able to create a sector', async () => {

        const {sector} = await sectorUseCase.execute({
            name: 'fiscal',
            budget: 100
        })
        expect(sector.id).toEqual(expect.any(String))
    })
    it('should not be able to create a sector with the same name as other one', async () => {
        await sectorUseCase.execute({
            name: 'fiscal',
            budget: 100
        })

        await expect(sectorUseCase.execute({
            name: 'fiscal',
            budget: 100
        })).rejects.toBeInstanceOf(ThisNameAlreadyExistsError)

    })

})
