import { expect, describe, it, beforeEach } from 'vitest'
import { InMemoryClientsRepository } from '@/modules/clients/repositories/in-memory/in-memory-clients-repository'
import { ClientUseCase } from '@/modules/clients/use-cases/client'




let clientsRepository: InMemoryClientsRepository
let clientUseCase: ClientUseCase


describe('Clients Use Case', () => {
    beforeEach(() => {
        clientsRepository = new InMemoryClientsRepository()
        clientUseCase = new ClientUseCase(clientsRepository)
    })
    it('should be able to create client', async () => {


        const client = await clientUseCase.execute({
            name: 'Thomás Furtado',
            email: 'thofurtado@gmail.com',
            identification: '10178665703'
        })

        expect(client.client.id).toEqual(expect.any(String))
    })

})
