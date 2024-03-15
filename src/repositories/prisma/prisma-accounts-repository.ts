import { prisma } from '@/lib/prisma'
import { Prisma } from '@prisma/client'
import { AccountsRepository } from '../accounts-repository'

export class PrismaAccountsRepository implements AccountsRepository {


    async findMany() {
        const accounts = await prisma.account.findMany()
        return accounts
    }
    async create(data: Prisma.AccountCreateInput) {
        const account = await prisma.account.create({
            data
        })
        return account
    }
    async findByName(name: string) {
        const account = await prisma.account.findFirst({
            where: {
                name
            }
        })
        return account
    }
    async findById(id: string) {

        const account = await prisma.account.findUnique({
            where: {
                id
            }
        })
        return account
    }
    async changeBalance(id: string, value: number, operationType: boolean) {

        const account = await this.findById(id)

        if (account) {
            await prisma.account.update({
                where: { id },
                data: {
                    balance: {
                        increment: operationType ? value : -value,
                    }
                }
            })
            //se for entrada acrescente, se for transferencia ou despesa sai
            return true
        }
        return false
    }
    async update(id: string, data: Prisma.AccountUpdateInput): Promise<Prisma.AccountGetPayload<typeof data> | null> {
        const updatedAccount = await prisma.account.update({
            where: { id },
            data,
        })
        return updatedAccount
    }

    async delete(id: string): Promise<void> {
        await prisma.account.delete({
            where: { id },
        })
    }
}
