import { UsersRepository } from '@/repositories/users-repository'
import { hash } from 'bcryptjs'
import { User } from '@prisma/client'


enum Role {
    ADMIN,
    TECHNICIAN
}
interface UpdateProfileUseCaseRequest {
    name?: string
    password?: string
    introduction?: string | null
    id: string
}

interface UpdateProfileUseCaseResponse {
    user: User
}
export class UpdateProfileUseCase {

    constructor(
        private usersRepository: UsersRepository
    ) { }
    async execute({
        id, name, password, introduction
    }: UpdateProfileUseCaseRequest): Promise<UpdateProfileUseCaseResponse> {
        let password_hash
        if(password)
            password_hash = await hash(password, 6)
        const user = await this.usersRepository.update( id , {
            name,
            password_hash,
            introduction
        })
        return {
            user
        }
    }
}

