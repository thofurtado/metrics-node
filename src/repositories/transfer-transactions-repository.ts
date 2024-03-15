import {Prisma, TransferTransaction} from '@prisma/client'

export interface TransferTransactionsRepository {
    create(data: Prisma.TransferTransactionUncheckedCreateInput):Promise<TransferTransaction>
    findByAccount(account_id:string):Promise<TransferTransaction[] | null> // when an account receive money
    findMany():Promise<TransferTransaction[] | null >
}
