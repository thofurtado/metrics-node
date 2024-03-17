import { prisma } from '@/lib/prisma'
import { Stock, Prisma } from '@prisma/client'
import { StocksRepository } from '../stocks-repository'

export class PrismaStocksRepository implements StocksRepository {
    async getItemHistory(item_id: string, start_date?: Date | undefined, end_date?: Date | undefined): Promise<{ id: string; item_id: string; quantity: number; operation: string; description: string | null; created_at: Date }[] | null> {
        // const stocks = await prisma.stock.findMany({
        //     where: {
        //         item_id
        //     }
        // })
        // return stocks
        const where: any = { item_id }

        // Se start_date for definido, adicione filtro de data maior ou igual
        if (start_date) {
            where.created_at = { gte: start_date }
        }

        // Se end_date for definido, adicione filtro de data menor ou igual
        if (end_date) {
            where.created_at = { ...where.created_at, lte: end_date }
        }

        const stocks = await prisma.stock.findMany({
            where,
        })

        return stocks
    }
    async getItemBalance(item_id: string): Promise<number> {
        const inputStocks = await prisma.stock.aggregate({
            _sum: {
                quantity: true, // Select the quantity field for summation
            },
            where: {
                item_id: item_id,
                operation: 'input',
            },
        })


        const outputStocks = await prisma.stock.aggregate({
            _sum: {
                quantity: true, // Select the quantity field for summation
            },
            where: {
                item_id: item_id,
                operation: 'output',
            },
        })
        const result = Number(inputStocks._sum.quantity) - Number(outputStocks._sum.quantity)
        return result
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
