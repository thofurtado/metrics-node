import { UsersRepository } from '@/modules/users/repositories/users-repository'
import { InvalidCredentialsError } from '@/errors/invalid-credentials-error'
import { compare } from 'bcryptjs'
import { User } from '@prisma/client'

interface AuthenticateUseCaseRequest {
    userId?: string;
    email?: string;
    password?: string;
    pin?: string;
}

interface AuthenticateUseCaseResponse {
    user: User
}

export class AuthenticateUseCase {
    constructor (
        private usersRepository: UsersRepository
    ) { }

    async execute({userId, email, password, pin}: AuthenticateUseCaseRequest): Promise<AuthenticateUseCaseResponse> {
        let user = null
        if (userId) {
            user = await this.usersRepository.findById(userId)
        } else if (email) {
            user = await this.usersRepository.findByEmail(email)
        }

        if(!user) {
            throw new InvalidCredentialsError()
        }

        let isCredentialsValid = false

        if (pin) {
            if (user.pin_hash) {
                isCredentialsValid = await compare(pin, user.pin_hash)
            }
        } else if (password) {
            isCredentialsValid = await compare(password, user.password_hash)
            if (!isCredentialsValid && user.pin_hash) {
                isCredentialsValid = await compare(password, user.pin_hash)
            }
        }

        if(!isCredentialsValid) {
            throw new InvalidCredentialsError()
        }

        return {
            user,
        }
    }
}
