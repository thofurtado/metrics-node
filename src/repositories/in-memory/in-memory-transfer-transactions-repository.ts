import { TransferTransaction, Prisma } from '@prisma/client'
import { TransferTransactionsRepository } from '../transfer-transactions-repository'
import { randomUUID } from 'node:crypto'





export class InMemoryTransferTransactionsRepository implements TransferTransactionsRepository {
    findByAccount(account_id: string): Promise<{ id: string; destination_account_id: string; transaction_id: string }[]> {
        throw new Error('Method not implemented.')
    }

    public items: TransferTransaction[] = []

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
