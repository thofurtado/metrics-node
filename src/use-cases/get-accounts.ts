import { AccountsRepository } from '@/repositories/accounts-repository'
import { Account } from '@prisma/client'


interface GetAccountsUseCaseResponse {
    accounts: Account[] | null
}
export class GetAccountsUseCase {

    constructor(
        private accountsRepository: AccountsRepository
    ) { }
    async execute(): Promise<GetAccountsUseCaseResponse> {

        const accounts = await this.accountsRepository.findMany()


        return {
            accounts
        }
    }
}

