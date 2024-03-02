import {  Prisma } from '@prisma/client'
import { TransferTransactionsRepository } from '../transfer-transactions-repository'
import { prisma } from '@/lib/prisma'





export class PrismaTransferTransactionsRepository implements TransferTransactionsRepository {


    async create(data: Prisma.TransferTransactionUncheckedCreateInput) {
        const transaction = prisma.transferTransaction.create({
            data
        })

        return transaction
    }
}
