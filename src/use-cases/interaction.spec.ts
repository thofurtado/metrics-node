import { expect, describe, it, beforeEach } from 'vitest'
import { InteractionUseCase } from './interaction'
import { InMemoryInteractionsRepository } from '@/repositories/in-memory/in-memory-interactions-repository'
import { InMemoryUsersRepository } from '@/repositories/in-memory/in-memory-users-repository'
import { InMemoryTreatmentsRepository } from '@/repositories/in-memory/in-memory-treatments-repository'
import { ResourceNotFoundError } from './errors/resource-not-found-error'


let interactionsRepository: InMemoryInteractionsRepository
let usersRepository: InMemoryUsersRepository
let treatmentsRepository: InMemoryTreatmentsRepository
let interactionUseCase: InteractionUseCase

describe('Interaction Use Case', () => {
    beforeEach(() => {
        interactionsRepository = new InMemoryInteractionsRepository()
        usersRepository = new InMemoryUsersRepository()
        treatmentsRepository = new InMemoryTreatmentsRepository()
        interactionUseCase = new InteractionUseCase(interactionsRepository, usersRepository, treatmentsRepository)
    })
    it('should be able to create an interaction', async () => {

        const user = await usersRepository.create({
            name: 'Luis Carlos',
            email: 'luizc@bol.com',
            password_hash: 'senha'
        })
        const treatment = await treatmentsRepository.create({
            opening_date: new Date(),
            request: 'Servidor travando',
            user_id: user.id
        })


        const { interaction } = await interactionUseCase.execute({
            user_id: user.id,
            treatment_id: treatment.id,
            description: 'Usuário não estava disponivel',
            date: new Date('11/02/2024 05:30:00')
        })

        expect(interaction.id).toEqual(expect.any(String))
    })
    it('should be able to create an interaction with a invalid treatment id', async () => {
        const user = await usersRepository.create({
            name: 'Luis Carlos',
            email: 'luizc@bol.com',
            password_hash: 'senha'
        })
        await expect(interactionUseCase.execute({
            user_id: user.id,
            treatment_id: 'treatment.id',
            description: 'Usuário não estava disponivel',
            date: new Date('11/02/2024 05:30:00')
        })).rejects.toBeInstanceOf(ResourceNotFoundError)
    })
    it('should be able to create an interaction with a invalid treatment id', async () => {
        const treatment = await treatmentsRepository.create({
            opening_date: new Date(),
            request: 'Servidor travando',
        })

        await expect(interactionUseCase.execute({
            user_id: 'user.id',
            treatment_id: treatment.id,
            description: 'Usuário não estava disponivel',
            date: new Date('11/02/2024 05:30:00')
        })).rejects.toBeInstanceOf(ResourceNotFoundError)
    })
})
