import {expect, describe, it, beforeEach} from 'vitest'
import { AuthenticateUseCase } from '@/modules/users/use-cases/authenticate'
import {  hash } from 'bcryptjs'
import { InMemoryUsersRepository } from '@/modules/users/repositories/in-memory/in-memory-users-repository'
import { InvalidCredentialsError } from '@/errors/invalid-credentials-error'



let usersRepository: InMemoryUsersRepository
let sut: AuthenticateUseCase
describe('Autenticathe Use Case', () => {
    beforeEach(() => {
        usersRepository = new InMemoryUsersRepository()
        sut = new AuthenticateUseCase(usersRepository)
    })

    it('should be able to authenticate', async () => {

        await usersRepository.create({
            name:'Zé das Coves',
            email: 'zedascoves@exemplo.com',
            password_hash: await hash('123456', 6)
        })

        const {user} = await sut.execute({
            email: 'zedascoves@exemplo.com',
            password: '123456'
        })

        expect(user.id).toEqual(expect.any(String))
    })
    it('it should not be able to authenticate with wrong email', async () => {

        await expect(sut.execute({
            email: 'zedascoves@exemplo.com',
            password: '123456'
        })).rejects.toBeInstanceOf(InvalidCredentialsError)
    })
    it('it should not be able to authenticate with wrong password', async () => {

        await usersRepository.create({
            name:'Zé das Coves',
            email: 'zedascoves@exemplo.com',
            password_hash: await hash('123456', 6)
        })
        await expect(sut.execute({
            email: 'zedascoves@exemplo.com',
            password: '123457'
        })).rejects.toBeInstanceOf(InvalidCredentialsError)
    })

    it('should be able to authenticate with PIN', async () => {
        await usersRepository.create({
            name: 'Operador Caixa',
            email: 'caixa@exemplo.com',
            password_hash: await hash('senha123', 6),
            pin_hash: await hash('4321', 6),
        })

        const { user } = await sut.execute({
            email: 'caixa@exemplo.com',
            pin: '4321'
        })

        expect(user.id).toEqual(expect.any(String))
    })

    it('should be able to authenticate if user inputs PIN into password field as fallback', async () => {
        await usersRepository.create({
            name: 'Garçom Salão',
            email: 'garcom@exemplo.com',
            password_hash: await hash('senhaGeral', 6),
            pin_hash: await hash('1234', 6),
        })

        const { user } = await sut.execute({
            email: 'garcom@exemplo.com',
            password: '1234'
        })

        expect(user.id).toEqual(expect.any(String))
    })
})
