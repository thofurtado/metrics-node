import { InMemorySuppliesRepository } from '@/repositories/in-memory/in-memory-supplies-repository'
import { CreateSupplyUseCase } from './create-supply'
import { describe, it, expect, beforeEach } from 'vitest'

let suppliesRepository: InMemorySuppliesRepository
let sut: CreateSupplyUseCase

describe('Create Supply Use Case', () => {
    beforeEach(() => {
        suppliesRepository = new InMemorySuppliesRepository()
        sut = new CreateSupplyUseCase(suppliesRepository)
    })

    it('should be able to create a new supply', async () => {
        const { supply } = await sut.execute({
            name: 'Farinha',
            cost: 2.50,
            stock: 100,
            unit: 'KG'
        })

        expect(supply.id).toEqual(expect.any(String))
        expect(suppliesRepository.items).toHaveLength(1)
        expect(suppliesRepository.items[0].name).toEqual('Farinha')
        expect(supply.cost).toEqual(2.50)
    })
})
