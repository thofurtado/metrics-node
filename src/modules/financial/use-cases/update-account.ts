import { AccountsRepository } from '@/modules/financial/repositories/accounts-repository'
import { Account } from '@prisma/client'
import { ResourceNotFoundError } from '@/errors/resource-not-found-error'

interface UpdateAccountUseCaseRequest {
    id: string
    name?: string
    description?: string | null
    goal?: number | null
}

interface UpdateAccountUseCaseResponse {
    account: Account
}

export class UpdateAccountUseCase {
    constructor(private accountsRepository: AccountsRepository) { }

    async execute({
        id,
        name,
        description,
        goal,
    }: UpdateAccountUseCaseRequest): Promise<UpdateAccountUseCaseResponse> {
        const account = await this.accountsRepository.findById(id)

        if (!account) {
            throw new ResourceNotFoundError()
        }

        const updatedAccount = await this.accountsRepository.update(id, {
            name,
            description,
            goal,
            // Balance is NOT updated here to ensure integrity
        })

        if (!updatedAccount) {
            throw new ResourceNotFoundError()
        }

        return {
            account: updatedAccount,
        }
    }
}
