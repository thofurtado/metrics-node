import { PrismaUsersRepository } from '@/modules/users/repositories/prisma/prisma-users-repository'
import { RegisterUseCase } from '@/modules/users/use-cases/register'


export function makeRegisterUseCase() {
    const usersRepository = new PrismaUsersRepository()
    const registerUseCase = new RegisterUseCase(usersRepository)
    return registerUseCase
}
