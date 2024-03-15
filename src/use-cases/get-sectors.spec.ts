import { expect, describe, it, beforeEach } from 'vitest'
import { InMemorySectorsRepository } from '@/repositories/in-memory/in-memory-sectors-repository'
import { GetSectorsUseCase } from './get-sectors'



let sectorsRepository: InMemorySectorsRepository
let getSectorsUseCase: GetSectorsUseCase


describe('Get Sectors Use Case', () => {
    beforeEach(() => {
        sectorsRepository = new InMemorySectorsRepository()
        getSectorsUseCase = new GetSectorsUseCase(sectorsRepository)
    })
    it('should be able to get sectors', async () => {

        await sectorsRepository.create({
            name: 'test1',
            budget: 0
        })
        await sectorsRepository.create({
            name: 'test2',
            budget: 0
        })
        await sectorsRepository.create({
            name: 'test3',
            budget: 0
        })
        await sectorsRepository.create({
            name: 'test4',
            budget: 0
        })

        const { sectors } = await getSectorsUseCase.execute()

        expect(sectors.length).toEqual(4)
    })

})
