import { prisma } from '@/lib/prisma'
import { Prisma, Service } from '@prisma/client'
import { ServicesRepository } from '../services-repository'

export class PrismaServicesRepository implements ServicesRepository {
    async create(data: Prisma.ServiceCreateInput, tx?: Prisma.TransactionClient): Promise<Service> {
        const client = tx ?? prisma
        return await client.service.create({ data })
    }

    async findById(id: string): Promise<Service | null> {
        return await prisma.service.findUnique({
            where: { id },
            include: {
                compositions: {
                    include: { supply: true }
                }
            }
        })
    }

    async findByName(name: string): Promise<Service | null> {
        return await prisma.service.findFirst({
            where: { name: { equals: name, mode: 'insensitive' } }
        })
    }

    async findMany(page: number, limit: number, query?: string, displayId?: number, isActive?: boolean): Promise<{ items: Service[], total: number }> {
        const offset = (page - 1) * limit

        const where: Prisma.ServiceWhereInput = {
            ...(isActive !== undefined ? { active: isActive } : {}),
            ...(query ? { name: { contains: query, mode: 'insensitive' } } : {}),
            ...(displayId ? { display_id: displayId } : {})
        }

        const [items, total] = await Promise.all([
            prisma.service.findMany({
                where,
                skip: offset,
                take: limit,
                orderBy: { name: 'asc' },
                include: {
                    compositions: {
                        include: { supply: true }
                    }
                }
            }),
            prisma.service.count({ where })
        ])

        return { items, total }
    }

    async update(id: string, data: Prisma.ServiceUpdateInput, tx?: Prisma.TransactionClient): Promise<Service> {
        const client = tx ?? prisma
        return await client.service.update({
            where: { id },
            data
        })
    }

    async delete(id: string, tx?: Prisma.TransactionClient): Promise<void> {
        const client = tx ?? prisma
        await client.service.delete({
            where: { id }
        })
    }

    async findNextAvailableDisplayId(tx?: Prisma.TransactionClient): Promise<number> {
        const client = tx ?? prisma

        const first = await client.$queryRawUnsafe<any[]>(`SELECT display_id FROM "services" WHERE display_id = 1 LIMIT 1`)

        if (!first || first.length === 0) return 1

        const result = await client.$queryRawUnsafe<{ next_id: number }[]>(`
            SELECT (t1.display_id + 1) as next_id 
            FROM "services" t1 
            LEFT JOIN "services" t2 ON t1.display_id + 1 = t2.display_id 
            WHERE t2.display_id IS NULL 
            ORDER BY t1.display_id ASC 
            LIMIT 1
        `)

        if (result.length > 0) {
            return result[0].next_id
        }

        const serv = await prisma.service.findFirst({ orderBy: { display_id: 'desc' } })
        const max = serv?.display_id ?? 0
        return max + 1
    }
}
