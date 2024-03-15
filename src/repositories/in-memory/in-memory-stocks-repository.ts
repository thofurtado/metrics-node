import { Stock, Prisma } from '@prisma/client'
import { StocksRepository } from '../stocks-repository'
import { randomUUID } from 'node:crypto'



export class InMemoryStocksRepository implements StocksRepository {
    public items: Stock[] = []
    async create(data: Prisma.StockUncheckedCreateInput): Promise<Stock> {
        const stock = {
            id: randomUUID(),
            item_id: data.item_id,
            quantity: data.quantity,
            operation: data.operation,
            description: data.description || null,
            created_at: data.created_at ? new Date(data.created_at) : new Date()
        }
        this.items.push(stock)
        return stock
    }

    async getItemHistory(item_id: string, start_date?: Date | undefined, end_date?: Date | undefined): Promise<Stock[] | null> {
        const filteredStocks = this.items.filter((item) => item.item_id === item_id)

        if (!filteredStocks.length) {
            return null
        }

        // Filter by dates if provided
        let history = filteredStocks
        if (start_date && end_date) {
            history = history.filter((item) => {
                const stockDate = new Date(item.created_at)
                return stockDate >= start_date && stockDate <= end_date
            })
        } else if (start_date) {
            history = history.filter((item) => new Date(item.created_at) >= start_date)
        } else if (end_date) {
            history = history.filter((item) => new Date(item.created_at) <= end_date)
        }

        return history
    }
    update(data: Prisma.UserUpdateInput): void {
        throw new Error('Method not implemented.')
    }
    delete(id: string): void {
        const index = this.items.findIndex((item) => item.id === id)
        if (index !== -1) {
            this.items.splice(index, 1)
        } else {
            throw new Error(`Interaction with ID ${id} not found`)
        }
    }

    async findById(id: string): Promise<Stock | null> {
        const stock = this.items.find(item => item.id === id)

        return stock || null
    }

}
