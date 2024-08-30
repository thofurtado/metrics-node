import {Prisma, Transaction} from '@prisma/client'
import { GetTransactionsDTO } from './DTO/get-transactions-dto'

export interface TransactionsRepository {
    create(data: Prisma.TransactionUncheckedCreateInput):Promise<Transaction>
    update(data: Prisma.TransactionUncheckedUpdateInput):Promise<Transaction>
    changeTransactionStatus(id:string):Promise<void>
    findMany(month: Date, pageIndex?: number, perPage?: number, description?: string, value?: number, sector_id?: string, account_id?:string ):Promise<GetTransactionsDTO | null>
    findById(id:string):Promise<Transaction | null>
    delete(id:string):Promise<void>
    getBalance():Promise<number>
    getMonthExpenseAmount():Promise<{monthExpenseAmount: number, diffFromLastMonth: number, alreadyPaid: number}>
    getMonthIncomeAmount():Promise<{monthIncomeAmount: number, diffFromLastMonth: number, alreadyPaid: number}>
    getMonthIncomeByDays():Promise<[{day: string, revenue: number}]>
    getMonthExpenseBySector():Promise<[{sector_name: string, amount: number}]>
}
