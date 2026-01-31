import { Prisma, TransferTransaction } from '@prisma/client'
import { TransferTransactionsRepository } from '../transfer-transactions-repository'
import { prisma } from '@/lib/prisma'





export class PrismaTransferTransactionsRepository implements TransferTransactionsRepository {
    async findByAccount(account_id: string): Promise<TransferTransaction[] | null> {
        const transferTransaction = prisma.transferTransaction.findMany({
            where: {
                destination_account_id: account_id
            }
        })
        return transferTransaction
    }


    async create(data: Prisma.TransferTransactionUncheckedCreateInput) {
        const transaction = prisma.transferTransaction.create({
            data
        })

        return transaction
    }
    async findMany() {
        const transferTransactions = await prisma.transferTransaction.findMany({
            include: {
                transaction: {
                    include: {
                        accounts: true
                    }
                },
                accounts: true
            },
            orderBy: {
                transaction: {
                    date: 'desc'
                }
            }
        })
        return transferTransactions
    }
}
