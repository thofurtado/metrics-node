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
    async findMany(): Promise<{ id: string; destination_account_id: string; transaction_id: string }[] | null> {
        const transferTransactions = prisma.transferTransaction.findMany()
        return transferTransactions
    }
}
