import { PrismaUsersRepository } from '@/modules/users/repositories/prisma/prisma-users-repository'
import { UpdateProfileUseCase } from '@/modules/users/use-cases/update-profile'


export function MakeUpdateProfileUseCase() {
    const usersRepository = new PrismaUsersRepository()
    const registerUseCase = new UpdateProfileUseCase(usersRepository)
    return registerUseCase
}
