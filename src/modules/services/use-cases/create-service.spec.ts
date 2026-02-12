import { InMemoryServicesRepository } from '@/modules/services/repositories/in-memory/in-memory-services-repository'
import { CreateServiceUseCase } from '@/modules/services/use-cases/create-service'
import { describe, it, expect, beforeEach } from 'vitest'

let servicesRepository: InMemoryServicesRepository
let sut: CreateServiceUseCase

describe('Create Service Use Case', () => {
    beforeEach(() => {
        servicesRepository = new InMemoryServicesRepository()
        sut = new CreateServiceUseCase(servicesRepository)
    })

    it('should be able to create a new service', async () => {
        const { service } = await sut.execute({
            name: 'Corte de Cabelo',
            price: 30.0,
            estimated_time: '30m'
        })

        expect(service.id).toEqual(expect.any(String))
        expect(servicesRepository.items).toHaveLength(1)
        expect(servicesRepository.items[0].name).toEqual('Corte de Cabelo')

        // Ensure strictly no stock field concept 
        expect((service as any).stock).toBeUndefined()
    })
})
