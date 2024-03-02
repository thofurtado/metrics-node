import { Account, Prisma } from '@prisma/client'
import { AccountsRepository } from '../accounts-repository'
import { randomUUID } from 'node:crypto'




export class InMemoryAccountsRepository implements AccountsRepository {


    public items: Account[] = []

    async changeBalance(id: string, value: number, isIncome: boolean){
        const account = await this.findById(id)

        if(account) {

            //se for entrada acrescente, se for transferencia ou despesa sai
            isIncome ? account.balance +=value : account.balance -=value
            return true
        }
        return false
    }
    async findByName(name: string) {
        const account = this.items.find(item => item.name === name)

        if (!account) {
            return null
        }
        return account
    }
    async findById(id: string) {

        const account = this.items.find(item => item.id === id)

        if (!account) {
            return null
        }
        return account
    }

    async create(data: Prisma.AccountCreateInput) {
        const account = {
            id: randomUUID(),
            name: data.name,
            description: data.description ?? null,
            goal: data.goal ? Number(data.goal) : null,
            balance: data.balance
        }
        this.items.push(account)
        return account
    }
}
