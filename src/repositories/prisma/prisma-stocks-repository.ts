import { prisma } from '@/lib/prisma'
import { Stock, Prisma, StockOperation, StockReason } from '@prisma/client'
import { StocksRepository } from '../stocks-repository'

export class PrismaStocksRepository implements StocksRepository {
    async getItemHistory(item_id: string, start_date?: Date | undefined, end_date?: Date | undefined): Promise<Stock[] | null> {
        const where: any = {
            OR: [
                { product_id: item_id },
                { supply_id: item_id }
            ]
        }

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
            orderBy: {
                created_at: 'desc'
            }
        })

        return stocks
    }
    async getItemBalance(item_id: string): Promise<number> {
        const whereInput = {
            OR: [
                { product_id: item_id },
                { supply_id: item_id }
            ],
            operation: StockOperation.IN
        }

        const whereOutput = {
            OR: [
                { product_id: item_id },
                { supply_id: item_id }
            ],
            operation: StockOperation.OUT
        }

        const inputStocks = await prisma.stock.aggregate({
            _sum: {
                quantity: true, // Select the quantity field for summation
            },
            where: whereInput
        })


        const outputStocks = await prisma.stock.aggregate({
            _sum: {
                quantity: true, // Select the quantity field for summation
            },
            where: whereOutput
        })
        const result = Number(inputStocks._sum.quantity) - Number(outputStocks._sum.quantity)
        return result
    }
    update(data: Prisma.UserUncheckedUpdateInput, tx?: Prisma.TransactionClient): void {
        throw new Error('Method not implemented.')
    }
    async delete(id: string, tx?: Prisma.TransactionClient): Promise<void> {
        const client = tx ?? prisma
        await client.stock.delete({
            where: {
                id
            }
        })
    }
    async create(data: Prisma.StockUncheckedCreateInput, tx?: Prisma.TransactionClient): Promise<Stock> {
        const client = tx ?? prisma
        const stock = await client.stock.create({
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
