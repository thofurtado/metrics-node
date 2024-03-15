import { AccountsRepository } from '@/repositories/accounts-repository'
import { Account } from '@prisma/client'
import { ThisNameAlreadyExistsError } from './errors/this-name-already-exists-error'
import {  OnlyNaturalNumbersError } from './errors/only-natural-numbers-error'

interface AccountUseCaseRequest {
    name: string;
    description?: string | null;
    goal?: number | null;
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
            throw new OnlyNaturalNumbersError()
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

