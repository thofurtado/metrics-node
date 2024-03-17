import { expect, describe, it, beforeEach } from 'vitest'
import { TreatmentUseCase } from './treatment'
import { InMemoryTreatmentsRepository } from '@/repositories/in-memory/in-memory-treatments-repository'
import { InMemoryClientsRepository } from '@/repositories/in-memory/in-memory-clients-repository'
import { InMemoryEquipmentsRepository } from '@/repositories/in-memory/in-memory-equipments-repository'
import { ResourceNotFoundError } from './errors/resource-not-found-error'
import { InMemoryUsersRepository } from '@/repositories/in-memory/in-memory-users-repository'



let treatmentsRepository: InMemoryTreatmentsRepository
let clientsRepository: InMemoryClientsRepository
let equipmentsRepository: InMemoryEquipmentsRepository
let usersRepository: InMemoryUsersRepository
let treatmentUseCase: TreatmentUseCase


describe('Treatment Use Case', () => {
    beforeEach(() => {
        clientsRepository = new InMemoryClientsRepository()
        treatmentsRepository = new InMemoryTreatmentsRepository()
        equipmentsRepository = new InMemoryEquipmentsRepository()
        usersRepository = new InMemoryUsersRepository()
        treatmentUseCase = new TreatmentUseCase(treatmentsRepository, clientsRepository, equipmentsRepository, usersRepository)
    })
    it('should be able to create treatment', async () => {

        const { treatment } = await treatmentUseCase.execute({
            contact: 'Thais',
            request: 'Computador esta sem sinal',
            observations: 'O computador de cima não da sinal no monitor, thais já tentou retirar os cabos, passei o passo a passo para desernegizar'
        })

        expect(treatment.id).toEqual(expect.any(String))

    })
    it('should not be able to create a treatment with an invalid client', async () => {
        await expect(treatmentUseCase.execute({
            contact: 'Thais',
            request: 'Computador esta sem sinal',
            observations: 'O computador de cima não da sinal no monitor, thais já tentou retirar os cabos, passei o passo a passo para desernegizar',
            client_id: 'client.id'
        })).rejects.toBeInstanceOf(ResourceNotFoundError)
    })
    it('should not be able to create a treatment with an invalid equipment', async () => {
        await expect(treatmentUseCase.execute({
            contact: 'Thais',
            request: 'Computador esta sem sinal',
            observations: 'O computador de cima não da sinal no monitor, thais já tentou retirar os cabos, passei o passo a passo para desernegizar',
            equipment_id: 'equipment.id'
        })).rejects.toBeInstanceOf(ResourceNotFoundError)
    })
    it('should not be able to create a treatment with an invalid user', async () => {
        await expect(treatmentUseCase.execute({
            contact: 'Thais',
            request: 'Computador esta sem sinal',
            observations: 'O computador de cima não da sinal no monitor, thais já tentou retirar os cabos, passei o passo a passo para desernegizar',
            user_id: 'user.id'
        })).rejects.toBeInstanceOf(ResourceNotFoundError)
    })
    it('should be able to create a treatment with a client', async () => {
        const client = await clientsRepository.create({
            name: 'Lojinha do dé',
            email: 'lojinha@dode.com.br',
            identification: '1111',
            phone: '12928938710',
            contract: false
        })
        const { treatment } = await treatmentUseCase.execute({
            contact: 'Thais',
            request: 'Computador esta sem sinal',
            observations: 'O computador de cima não da sinal no monitor, thais já tentou retirar os cabos, passei o passo a passo para desernegizar',
            client_id: client.id
        })

        expect(treatment.id).toEqual(expect.any(String))
    })
    it('should be able to create a treatment with an equipment', async () => {
        const client = await clientsRepository.create({
            name: 'Lojinha do dé',
            email: 'lojinha@dode.com.br',
            identification: '1111',
            phone: '12928938710',
            contract: false
        })
        const equipment = await equipmentsRepository.create({
            client_id: client.id,
            type: 'CPU',
            entry: new Date()
        })

        const { treatment } = await treatmentUseCase.execute({
            contact: 'Thais',
            request: 'Computador esta sem sinal',
            observations: 'O computador de cima não da sinal no monitor, thais já tentou retirar os cabos, passei o passo a passo para desernegizar',
            equipment_id: equipment.id,
            client_id: client.id
        })

        expect(treatment.id).toEqual(expect.any(String))
    })
    it('should be able to create a treatment with his dependencys', async () => {
        const client = await clientsRepository.create({
            name: 'Lojinha do dé',
            email: 'lojinha@dode.com.br',
            identification: '1111',
            phone: '12928938710',
            contract: false
        })
        const equipment = await equipmentsRepository.create({
            client_id: client.id,
            type: 'CPU',
            entry: new Date()
        })
        const user = await usersRepository.create({
            name: 'Técnico externo',
            email: 'tecnicoexterno@toptech.com.br',
            password_hash: 'uashnuaisnaskamoia'
        })
        const { treatment } = await treatmentUseCase.execute({
            contact: 'Thais',
            request: 'Computador esta sem sinal',
            observations: 'O computador de cima não da sinal no monitor, thais já tentou retirar os cabos, passei o passo a passo para desernegizar',
            equipment_id: equipment.id,
            client_id: client.id,
            user_id: user.id
        })

        expect(treatment.id).toEqual(expect.any(String))
    })
})
