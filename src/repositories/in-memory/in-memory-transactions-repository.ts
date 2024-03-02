import { Transaction, Prisma } from '@prisma/client'
import { TransactionsRepository } from '../transactions-repository'
import { randomUUID } from 'node:crypto'





export class InMemoryTransactionsRepository implements TransactionsRepository {

    public items: Transaction[] = []

    async create(data: Prisma.TransactionUncheckedCreateInput) {
        const transaction = {
            id: randomUUID(),
            operation: data.operation,
            amount: data.amount,
            account_id: data.account_id,
            date: data.date ? new Date(data.date) : new Date() ,
            sector_id: data.sector_id ?? null,
            description: data.description ?? null,
            confirmed: data.confirmed ?? false,
        }
        this.items.push(transaction)
        return transaction
    }
}
