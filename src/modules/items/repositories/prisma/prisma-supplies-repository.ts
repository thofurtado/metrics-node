import { prisma } from '@/lib/prisma'
import { Prisma, Supply } from '@prisma/client'
import { SuppliesRepository } from '../supplies-repository'

export class PrismaSuppliesRepository implements SuppliesRepository {
    async create(data: Prisma.SupplyCreateInput, tx?: Prisma.TransactionClient): Promise<Supply> {
        const client = tx ?? prisma
        return await client.supply.create({ data })
    }

    async findById(id: string): Promise<Supply | null> {
        return await prisma.supply.findUnique({
            where: { id }
        })
    }

    async findByName(name: string): Promise<Supply | null> {
        return await prisma.supply.findFirst({
            where: { name: { equals: name, mode: 'insensitive' } }
        })
    }

    async findMany(page: number, limit: number, query?: string, isActive?: boolean): Promise<{ items: Supply[], total: number }> {
        const offset = (page - 1) * limit

        const where: Prisma.SupplyWhereInput = {
            ...(isActive !== undefined ? { active: isActive } : {}),
            ...(query ? { name: { contains: query, mode: 'insensitive' } } : {})
        }

        const [items, total] = await Promise.all([
            prisma.supply.findMany({
                where,
                skip: offset,
                take: limit,
                orderBy: { name: 'asc' }
            }),
            prisma.supply.count({ where })
        ])

        return { items, total }
    }

    async update(id: string, data: Prisma.SupplyUpdateInput, tx?: Prisma.TransactionClient): Promise<Supply> {
        const client = tx ?? prisma
        return await client.supply.update({
            where: { id },
            data
        })
    }

    async delete(id: string, tx?: Prisma.TransactionClient): Promise<void> {
        const client = tx ?? prisma
        await client.supply.delete({
            where: { id }
        })
    }

    async changeStock(id: string, quantity: number, operationType: boolean, tx?: Prisma.TransactionClient, cost?: number): Promise<void> {
        const client = tx ?? prisma

        const data: Prisma.SupplyUpdateInput = {
            stock: operationType ? { increment: quantity } : { decrement: quantity }
        }

        if (cost !== undefined) {
            data.cost = cost
        }

        await client.supply.update({
            where: { id },
            data
        })
    }
}
