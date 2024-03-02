import {expect, describe, it, beforeEach} from 'vitest'
import { AuthenticateUseCase } from './authenticate'
import {  hash } from 'bcryptjs'
import { InMemoryUsersRepository } from '@/repositories/in-memory/in-memory-users-repository'
import { InvalidCredentialsError } from './errors/invalid-credentials-error'



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
})
