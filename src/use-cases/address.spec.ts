import {expect, describe, it,beforeEach} from 'vitest'
import { AddressUseCase } from './address'
import { InMemoryAddressessRepository } from '@/repositories/in-memory/in-memory-addressess-repository'
import { InMemoryClientsRepository } from '@/repositories/in-memory/in-memory-clients-repository'
import { ResourceNotFoundError } from './errors/resource-not-found-error'




let clientsRepository: InMemoryClientsRepository
let addressRepository: InMemoryAddressessRepository
let addressUseCase: AddressUseCase


describe('Address Use Case', () => {
    beforeEach(() => {

        addressRepository = new InMemoryAddressessRepository()
        clientsRepository = new InMemoryClientsRepository()
        addressUseCase = new AddressUseCase(addressRepository,clientsRepository)
    })
    it('should be able to create a address', async () => {
        const client = await clientsRepository.create({
            name: 'Thomás Furtado',
            email: 'thofurtado@gmail.com',
            identification: '10178665703'
        })

        const {address} = await addressUseCase.execute({
            street: 'Rua Tatsuo Matsumoto',
            number: 180,
            neighborhood: 'Capricórnio II',
            city: 'Caraguatatuba',
            state: 'SP',
            zipcode: 11676405,
            client_id: client.id
        })

        expect(address.id).toEqual(expect.any(String))
    })
    it('should not be able to create a address without a client', async () => {

        await expect(addressUseCase.execute({
            street: 'Rua Tatsuo Matsumoto',
            number: 180,
            neighborhood: 'Capricórnio II',
            city: 'Caraguatatuba',
            state: 'SP',
            zipcode: 11676405,
            client_id: 'client.id'
        })).rejects.toBeInstanceOf(ResourceNotFoundError)
    })

})
