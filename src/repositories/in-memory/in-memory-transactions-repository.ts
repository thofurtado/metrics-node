import { Transaction, Prisma } from '@prisma/client'
import { TransactionsRepository } from '../transactions-repository'
import { randomUUID } from 'node:crypto'





export class InMemoryTransactionsRepository implements TransactionsRepository {


    public items: Transaction[] = []

    update(data: Prisma.TransactionUncheckedUpdateInput): Promise<{ id: string; operation: string; date: Date; amount: number; account_id: string; sector_id: string | null; description: string | null; confirmed: boolean }> {
        throw new Error('Method not implemented.')
    }
    async findMany(operation?: string | undefined, paid?: boolean | undefined, sector_id?: string | undefined, account_id?: string | undefined): Promise<Transaction[] | null> {
        const transaction = this.items

        return transaction
    }

    async create(data: Prisma.TransactionUncheckedCreateInput) {
        const transaction = {
            id: randomUUID(),
            operation: data.operation,
            amount: data.amount,
            account_id: data.account_id,
            date: data.date ? new Date(data.date) : new Date(),
            sector_id: data.sector_id ?? null,
            description: data.description ?? null,
            confirmed: data.confirmed ?? false,
        }
        this.items.push(transaction)
        return transaction
    }
    async all() {

        // if(sector_id && account_id)
        //     const transaction = this.items.find((item) => item.sector_id === sector_id || item.account_id === account_id)

    }
    async findById(id: string): Promise<Transaction | null> {
        const transaction = this.items.find(item => item.id === id)
        return transaction || null
    }
}
