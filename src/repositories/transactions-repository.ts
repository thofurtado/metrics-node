import {Prisma, Transaction} from '@prisma/client'

export interface TransactionsRepository {
    create(data: Prisma.TransactionUncheckedCreateInput):Promise<Transaction>
    update(data: Prisma.TransactionUncheckedUpdateInput):Promise<Transaction>
    updateTransactionStatus(id:string, status: boolean):Promise<void>
    findMany(operation?:string, paid?:boolean, sector_id?:string, account_id?:string ):Promise<Transaction[] | null>
    findById(id:string):Promise<Transaction | null>
}
