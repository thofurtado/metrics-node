import {expect, describe, it,beforeEach} from 'vitest'
import { RegisterUseCase } from './register'


import { compare } from 'bcryptjs'
import { InMemoryUsersRepository } from '@/repositories/in-memory/in-memory-users-repository'
import { UserAlreadyExistsError } from './errors/user-already-exists-error'


let usersRepository: InMemoryUsersRepository
let registerUseCase: RegisterUseCase

describe('Register Use Case', () => {
    beforeEach(() => {
        usersRepository = new InMemoryUsersRepository()
        registerUseCase = new RegisterUseCase(usersRepository)
    })
    it('should be able to register', async () => {

        const {user} = await registerUseCase.execute({
            name: 'Zé das coves',
            email: 'zedascoves2@exemplo.com',
            password: '123456'
        })

        expect(user.id).toEqual(expect.any(String))
    })
    it('should had user password upon registration', async () => {


        const {user} = await registerUseCase.execute({
            name: 'Zé das coves',
            email: 'zedascoves2@exemplo.com',
            password: '123456'
        })
        const isPasswordHashed = await compare(
            '123456',
            user.password_hash
        )

        expect(isPasswordHashed).toBe(true)
    })
    it('should not be able to register with same email twice', async () => {

        const email = 'zedascoves2@exemplo.com'

        await registerUseCase.execute({
            name: 'Zé das coves',
            email: email,
            password: '123456'
        })



        await expect(() => registerUseCase.execute({
            name: 'Zé das coves',
            email: email,
            password: '123456'
        })).rejects.toBeInstanceOf(UserAlreadyExistsError)
    })
})
