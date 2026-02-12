import { prisma } from '@/lib/prisma'
import { Prisma, Supply } from '@prisma/client'
import { SuppliesRepository } from '@/repositories/supplies-repository'
import { ResourceDependencyError } from '@/errors/resource-dependency-error'

export class PrismaSuppliesRepository implements SuppliesRepository {
    async create(data: Prisma.SupplyCreateInput): Promise<Supply> {
        return await prisma.supply.create({
            data,
        })
    }

    async findById(id: string, tx?: Prisma.TransactionClient): Promise<Supply | null> {
        const client = tx || prisma
        return await client.supply.findUnique({
            where: { id },
        })
    }

    async findByName(name: string): Promise<Supply | null> {
        return await prisma.supply.findFirst({
            where: { name },
        })
    }

    async findMany(page: number, perPage: number, query?: string): Promise<{ supplies: Supply[], count: number }> {
        const [supplies, count] = await Promise.all([
            prisma.supply.findMany({
                where: {
                    name: { contains: query, mode: 'insensitive' }
                },
                take: perPage,
                skip: (page - 1) * perPage,
            }),
            prisma.supply.count({
                where: {
                    name: { contains: query, mode: 'insensitive' }
                }
            })
        ])
        return { supplies, count }
    }

    async save(supply: Supply, tx?: Prisma.TransactionClient): Promise<Supply> {
        const client = tx || prisma
        return await client.supply.update({
            where: { id: supply.id },
            data: supply,
        })
    }

    async delete(id: string): Promise<void> {
        try {
            await prisma.supply.delete({
                where: { id }
            })
        } catch (error) {
            if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2003') {
                throw new ResourceDependencyError()
            }
            throw error
        }
    }

    async decreaseStock(id: string, quantity: number, tx?: Prisma.TransactionClient): Promise<void> {
        const client = tx || prisma
        await client.supply.update({
            where: { id },
            data: {
                stock: {
                    decrement: quantity
                }
            }
        })
    }
}
