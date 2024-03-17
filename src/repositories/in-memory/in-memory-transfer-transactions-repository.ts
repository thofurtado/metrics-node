import { TransferTransaction, Prisma } from '@prisma/client'
import { TransferTransactionsRepository } from '../transfer-transactions-repository'
import { randomUUID } from 'node:crypto'





export class InMemoryTransferTransactionsRepository implements TransferTransactionsRepository {


    public items: TransferTransaction[] = []
    async findMany(): Promise<{ id: string; destination_account_id: string; transaction_id: string; }[] | null> {
        const transferTransactions =  this.items
        return transferTransactions
    }
    async findByAccount(account_id: string): Promise<{ id: string; destination_account_id: string; transaction_id: string }[]> {
        const transferTransactions =  this.items.filter(item => item.destination_account_id === account_id)
        return transferTransactions
    }
    async create(data: Prisma.TransferTransactionUncheckedCreateInput) {
        const transaction = {
            id: randomUUID(),
            destination_account_id: data.destination_account_id,
            transaction_id: data.transaction_id
        }
        this.items.push(transaction)
        return transaction
    }
}
