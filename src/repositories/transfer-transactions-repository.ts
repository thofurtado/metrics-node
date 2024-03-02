import {Prisma, TransferTransaction} from '@prisma/client'

export interface TransferTransactionsRepository {
    create(data: Prisma.TransferTransactionUncheckedCreateInput):Promise<TransferTransaction>
}
