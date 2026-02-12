import { AccountsRepository } from '@/modules/financial/repositories/accounts-repository'
import { ResourceNotFoundError } from '@/errors/resource-not-found-error'

interface DeleteAccountUseCaseRequest {
    id: string
}

export class DeleteAccountUseCase {
    constructor(private accountsRepository: AccountsRepository) { }

    async execute({ id }: DeleteAccountUseCaseRequest): Promise<void> {
        const account = await this.accountsRepository.findById(id)

        if (!account) {
            throw new ResourceNotFoundError()
        }

        await this.accountsRepository.delete(id)
    }
}
