import { prisma } from '@/lib/prisma'
import { Prisma } from '@prisma/client'
import { AccountsRepository } from '@/modules/financial/repositories/accounts-repository'

export class PrismaAccountsRepository implements AccountsRepository {


    async findMany() {
        const accounts = await prisma.account.findMany({
            orderBy: [
                {
                    name: 'asc'
                }
            ],

        })
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
    async changeBalance(id: string, value: number, operationType: boolean, tx?: Prisma.TransactionClient) {

        // We cannot use this.findById(id) here because we need the transaction client context
        // and findById might not use it (unless we pass it there too, which we aren't doing yet)
        // But for update, we just need to know it works. 
        // Let's assume the caller has verified existence or we trust the update will fail if not found (Prisma throws or returns nothing).
        // Actually Prisma update throws if not found. 

        const client = tx ?? prisma

        try {
            await client.account.update({
                where: { id },
                data: {
                    balance: {
                        increment: operationType ? value : -value,
                    }
                }
            })
            return true
        } catch (e) {
            return false
        }
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
