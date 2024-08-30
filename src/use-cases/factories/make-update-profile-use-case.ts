import { PrismaUsersRepository } from '@/repositories/prisma/prisma-users-repository'
import { UpdateProfileUseCase } from '../update-profile'


export function MakeUpdateProfileUseCase() {
    const usersRepository = new PrismaUsersRepository()
    const registerUseCase = new UpdateProfileUseCase(usersRepository)
    return registerUseCase
}
