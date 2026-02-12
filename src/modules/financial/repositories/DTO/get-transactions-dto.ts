import { Transaction } from '@prisma/client'

export interface GetTransactionsDTO {
    transactions: Transaction[],
    totalCount: number,
    perPage: number,
    pageIndex: number
}
