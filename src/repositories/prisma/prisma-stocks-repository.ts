import { prisma } from '@/lib/prisma'
import { Stock, Prisma } from '@prisma/client'
import { StocksRepository } from '../stocks-repository'

export class PrismaStocksRepository implements StocksRepository {
    async getItemHistory(item_id: string, start_date?: Date | undefined, end_date?: Date | undefined): Promise<{ id: string; item_id: string; quantity: number; operation: string; description: string | null; created_at: Date }[] | null> {
        const stocks = await prisma.stock.findMany({
            where: {
                item_id
            }
        })
        return stocks
    }
    async update(data: Prisma.UserUncheckedUpdateInput): void {
        throw new Error('Method not implemented.')
    }
    async delete(id: string): Promise<void> {
        await prisma.stock.delete({
            where: {
                id
            }
        })
    }
    async create(data: Prisma.StockUncheckedCreateInput): Promise<Stock> {
        const stock = await prisma.stock.create({
            data
        })
        return stock
    }

    async findById(id: string): Promise<Stock | null> {
        const stock = await prisma.stock.findFirst({
            where: {
                id
            }
        })
        return stock
    }


}
