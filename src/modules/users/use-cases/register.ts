import { UsersRepository } from '@/modules/users/repositories/users-repository'
import { hash } from 'bcryptjs'
import { UserAlreadyExistsError } from '@/modules/users/use-cases/user-already-exists-error'
import { User, Role } from '@prisma/client'


interface RegistryUseCaseRequest {
    name: string
    email: string
    password: string
    introduction?: string | null
}

interface RegisterUseCaseResponse {
    user: User
}
export class RegisterUseCase {

    constructor(
        private usersRepository: UsersRepository
    ) { }
    async execute({
        name, email, password, introduction
    }: RegistryUseCaseRequest): Promise<RegisterUseCaseResponse> {

        const userWithSameEmail = await this.usersRepository.findByEmail(email)

        if (userWithSameEmail) {
            throw new UserAlreadyExistsError()
        }

        const password_hash = await hash(password, 6)
        const user = await this.usersRepository.create({
            name,
            email,
            password_hash,
            introduction
        })
        return {
            user
        }
    }
}

