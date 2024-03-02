import { AccountsRepository } from '@/repositories/accounts-repository'
import { Account } from '@prisma/client'
import { ThisNameAlreadyExistsError } from './errors/this-name-already-exists-error'
import {  NoNegativeValuesAllowedError } from './errors/no-negative-values-allowed-error'

interface AccountUseCaseRequest {
    name: string;
    description: string | undefined;
    goal: number | undefined;
    balance: number;
}

interface AccountUseCaseResponse {
    account: Account
}
export class AccountUseCase {

    constructor(
        private accountsRepository: AccountsRepository
    ) { }
    async execute({
        name, description, goal, balance
    }: AccountUseCaseRequest): Promise<AccountUseCaseResponse> {

        const accountWithSameName = await this.accountsRepository.findByName(name)

        if(accountWithSameName !== null){
            throw new ThisNameAlreadyExistsError()
        }

        if(balance<0) {
            throw new NoNegativeValuesAllowedError()
        }
        const account = await this.accountsRepository.create({
            name,
            description,
            goal,
            balance
        })
        return {
            account
        }
    }
}

