import { PrismaUsersRepository } from '@/modules/users/repositories/prisma/prisma-users-repository'
import { AuthenticateUseCase } from '@/modules/users/use-cases/authenticate'



export function makeAuthenticateUseCase() {
    const usersRepository = new PrismaUsersRepository()
    const authenticateUseCase = new AuthenticateUseCase(usersRepository)
    return authenticateUseCase
}
