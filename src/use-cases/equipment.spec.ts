import {expect, describe, it,beforeEach} from 'vitest'
import { EquipmentUseCase } from './equipment'
import { InMemoryEquipmentsRepository } from '@/repositories/in-memory/in-memory-equipments-repository'
import { InMemoryClientsRepository } from '@/repositories/in-memory/in-memory-clients-repository'
import { ResourceNotFoundError } from './errors/resource-not-found-error'




let clientsRepository: InMemoryClientsRepository
let equipmentRepository: InMemoryEquipmentsRepository
let equipmentUseCase: EquipmentUseCase


describe('Equipment Use Case', () => {
    beforeEach(() => {
        equipmentRepository = new InMemoryEquipmentsRepository()
        clientsRepository = new InMemoryClientsRepository()
        equipmentUseCase = new EquipmentUseCase(equipmentRepository, clientsRepository)
    })

    it('should be able to create a equipment', async () => {


        const client = await clientsRepository.create({
            name: 'Zé das coves',
            email: 'zedascoves@bol.com',
            identification: '11111111111'
        })
        const {equipment} = await equipmentUseCase.execute({
            client_id: client.id,
            type: 'Computador',
            entry: new Date()
        })

        expect(equipment.id).toEqual(expect.any(String))
    })
    it('should not be able to create a equipment without a valid client', async () => {
        await expect(equipmentUseCase.execute({
            client_id: 'client.id',
            type: 'Computador',
            entry: new Date()
        })
        ).rejects.toBeInstanceOf(ResourceNotFoundError)
    })

})
