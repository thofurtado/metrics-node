import { Account, Prisma } from '@prisma/client'
import { AccountsRepository } from '../accounts-repository'
import { randomUUID } from 'node:crypto'




export class InMemoryAccountsRepository implements AccountsRepository {


    public items: Account[] = []

    async findMany(): Promise<{ id: string; name: string; description: string | null; balance: number; goal: number | null; }[]> {
        const accounts = this.items

        return accounts
    }


    async changeBalance(id: string, value: number, isIncome: boolean) {
        const account = await this.findById(id)

        if (account) {

            //se for entrada acrescente, se for transferencia ou despesa sai
            isIncome ? account.balance += value : account.balance -= value
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

    async update(id: string, data: Prisma.AccountUpdateInput): Promise<Account | null> {
        const index = this.items.findIndex((item) => item.id === id)

        if (index === -1) {
            return null
        }

        const account = this.items[index]

        const updatedAccount = {
            ...account,
            ...data,
        } as unknown as Account

        this.items[index] = updatedAccount

        return updatedAccount
    }

    async delete(id: string): Promise<void> {
        const index = this.items.findIndex((item) => item.id === id)
        if (index !== -1) {
            this.items.splice(index, 1)
        }
    }
}
