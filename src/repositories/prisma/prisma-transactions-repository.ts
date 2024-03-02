import { Prisma } from '@prisma/client'
import { TransactionsRepository } from '../transactions-repository'
import { prisma } from '@/lib/prisma'






export class PrismaTransactionsRepository implements TransactionsRepository {



    async create(data: Prisma.TransactionUncheckedCreateInput) {
        const transaction = prisma.transaction.create({
            data
        })

        return transaction
    }
}
