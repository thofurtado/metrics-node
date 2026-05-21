import { prisma } from '@/lib/prisma'
import { Prisma, Sale } from '@prisma/client'
import { SalesRepository } from '../sales-repository'

export class PrismaSalesRepository implements SalesRepository {
    async create(data: Prisma.SaleUncheckedCreateInput, tx?: Prisma.TransactionClient): Promise<Sale> {
        const client = tx ?? prisma
        
        // Extract items if they are part of nested creation
        // Unchecked create doesn't typed relational fields usually in TS, but Prisma accepts nested input if created via standard CreateInput.
        // Let's cast to any to bypass strict unchecked creation if we're doing nested items
        const sale = await (client.sale.create as any)({
            data
        })
        
        return sale
    }

    async findById(id: string): Promise<Sale | null> {
        const sale = await prisma.sale.findUnique({
            where: { id },
            include: {
                items: {
                    include: {
                        product: true,
                        service: true,
                        supply: true
                    }
                },
                treatment: true
            }
        })
        
        return sale
    }

    async list(pageIndex: number = 1, perPage: number = 20): Promise<{ sales: Sale[], totalCount: number }> {
        const skip = (pageIndex - 1) * perPage
        const take = perPage

        const [sales, totalCount] = await Promise.all([
            prisma.sale.findMany({
                skip,
                take,
                orderBy: { created_at: 'desc' },
                include: {
                    items: true
                }
            }),
            prisma.sale.count()
        ])

        return { sales, totalCount }
    }
}
