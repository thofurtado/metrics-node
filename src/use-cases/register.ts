import { UsersRepository } from '@/repositories/users-repository'
import { hash } from 'bcryptjs'
import { UserAlreadyExistsError } from './errors/user-already-exists-error'
import { User } from '@prisma/client'


enum Role {
    ADMIN,
    TECHNICIAN
}
interface RegistryUseCaseRequest {
    name: string
    email: string
    password: string
    role?: Role | undefined,
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
        name, email, password, role, introduction
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
            role,
            introduction
        })
        return {
            user
        }
    }
}

