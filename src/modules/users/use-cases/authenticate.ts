import { UsersRepository } from '@/modules/users/repositories/users-repository'
import { InvalidCredentialsError } from '@/errors/invalid-credentials-error'
import { compare } from 'bcryptjs'
import { User } from '@prisma/client'

interface AuthenticateUseCaseRequest {
    userId?: string;
    email?: string;
    password: string;
}

interface AuthenticateUseCaseResponse {
    user: User
}

export class AuthenticateUseCase {
    constructor (
        private usersRepository: UsersRepository
    ) { }

    async execute({userId, email, password}: AuthenticateUseCaseRequest): Promise<AuthenticateUseCaseResponse> {
        let user = null
        if (userId) {
            user = await this.usersRepository.findById(userId)
        } else if (email) {
            user = await this.usersRepository.findByEmail(email)
        }

        if(!user) {
            throw new InvalidCredentialsError()
        }

        const doesPasswordMatches = await compare(password, user.password_hash)

        if(!doesPasswordMatches) {
            throw new InvalidCredentialsError()
        }

        return {
            user,
        }
    }
}
