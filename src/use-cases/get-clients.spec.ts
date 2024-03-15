import { expect, describe, it, beforeEach } from 'vitest'
import { InMemoryClientsRepository } from '@/repositories/in-memory/in-memory-clients-repository'
import { GetClientsUseCase } from './get-clients'



let clientsRepository: InMemoryClientsRepository
let getClientsUseCase: GetClientsUseCase


describe('Get Clients Use Case', () => {
    beforeEach(() => {
        clientsRepository = new InMemoryClientsRepository()
        getClientsUseCase = new GetClientsUseCase(clientsRepository)
    })
    it('should be able to get clients', async () => {

        await clientsRepository.create({
            name: 'test1',
            identification: '',
            email: ''
        })
        await clientsRepository.create({
            name: 'test2',
            identification: '',
            email: ''
        })
        await clientsRepository.create({
            name: 'test3',
            identification: '',
            email: ''
        })
        await clientsRepository.create({
            name: 'test4',
            identification: '',
            email: ''
        })

        const  clients  = await getClientsUseCase.execute()

        expect(clients.clients?.length).toEqual(4)
    })

})
