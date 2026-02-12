import { PrismaUsersRepository } from '@/modules/users/repositories/prisma/prisma-users-repository'
import { GetUserProfileUseCase } from '@/modules/users/use-cases/get-user-profile'

export function makeGetUserProfileUseCase() {
    const usersRepository = new PrismaUsersRepository()
    const getUserProfileUseCase = new GetUserProfileUseCase(usersRepository)
    return getUserProfileUseCase
}
