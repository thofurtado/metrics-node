import { Prisma, Transaction } from '@prisma/client'
import { TransactionsRepository } from '../transactions-repository'
import { prisma } from '@/lib/prisma'






export class PrismaTransactionsRepository implements TransactionsRepository {
    async updateTransactionStatus(id: string, status: boolean): Promise<void> {
        const findedTransaction = await prisma.transaction.findFirst({where: {id}})
        if(findedTransaction?.confirmed !== status){
            await prisma.transaction.update({
                where: {id},
                data: {
                    confirmed: status
                }
            })
        }
    }
    update(data: Prisma.TransactionUncheckedUpdateInput): Promise<{ id: string; operation: string; date: Date; amount: number; account_id: string; sector_id: string | null; description: string | null; confirmed: boolean }> {
        throw new Error('Method not implemented.')
    }
    findMany(operation?: string | undefined, paid?: boolean | undefined, sector_id?: string | undefined, account_id?: string | undefined): Promise<{ id: string; operation: string; date: Date; amount: number; account_id: string; sector_id: string | null; description: string | null; confirmed: boolean }[] | null> {
        const transactions = prisma.transaction.findMany()
        return transactions
    }
    async findById(id: string): Promise<Transaction | null> {
        const transaction = prisma.transaction.findFirst({
            where: {
                id
            }
        })
        return transaction
    }

    async create(data: Prisma.TransactionUncheckedCreateInput) {
        if (!data.date) {
            data.date = new Date()
        }
        if (!data.confirmed) {
            data.confirmed = false
        }
        const createTransaction = {
            ...data,
            account_id: undefined,
            sector_id: undefined
        }
        let transaction
        if (!data.sector_id) {
            transaction = await prisma.transaction.create({
                data: {
                    ...createTransaction,
                    accounts: {
                        connect: { id: data.account_id }
                    }
                }

            })
        } else {
            transaction = await prisma.transaction.create({
                data: {
                    ...createTransaction,
                    accounts: {
                        connect: { id: data.account_id }
                    },
                    sectors: {
                        connect: { id: data.sector_id }
                    }
                }
            })
        }

        return transaction
    }

}
