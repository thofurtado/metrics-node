import { prisma } from '@/lib/prisma'
import { Item, Prisma } from '@prisma/client'
import { ItemsRepository } from '../items-repository'
import { GetItemsDTO } from '../DTO/get-items-dto'

export class PrismaItemsRepository implements ItemsRepository {
    async create(data: Prisma.ItemCreateInput, tx?: Prisma.TransactionClient): Promise<Item> {
        const client = tx ?? prisma
        const item = await client.item.create({
            data
        })
        return item
    }
    async findByName(name: string, is_active?: boolean | undefined): Promise<Item[] | null> {
        let item
        if (is_active) {
            item = await prisma.item.findMany({
                where: {
                    AND: [
                        { name: name },
                        { active: is_active }
                    ]

                }
            })
        }
        else {
            item = await prisma.item.findMany({
                where: {
                    name
                }
            })
        }

        if (item.length === 0)
            return null
        return item
    }
    async findById(id: string): Promise<Item | null> {
        const item = await prisma.item.findFirst({
            where: {
                id
            }
        })
        return item
    }
    async findMany(is_active?: boolean | undefined, is_product?: boolean | undefined, pageIndex?: number, perPage?: number, name?: string, display_id?: number, below_min_stock?: boolean): Promise<GetItemsDTO | null> {
        const page = Math.max(1, pageIndex || 1)
        const limit = perPage || 10
        const skip = (page - 1) * limit

        const where: Prisma.ItemWhereInput = {}
        if (is_active !== undefined) where.active = is_active
        if (is_product !== undefined) where.isItem = is_product
        if (name) where.name = { contains: name, mode: 'insensitive' }
        // @ts-ignore: Prisma types might be stale regarding display_id
        if (display_id) (where as any).display_id = display_id

        if (below_min_stock) {
            // Prisma doesn't natively support field vs field comparison in where clause easily
            // So we fetch IDs of items where stock <= min_stock via raw query
            // This is safe because we just fetch IDs
            // We use quotes for "isItem" to ensure case sensitivity in Postgres if strictly needed, 
            // though Prisma usually maps it correctly.
            const criticalItems = await prisma.$queryRaw<{ id: string }[]>`
                SELECT id FROM items WHERE stock <= min_stock AND "isItem" = true
             `
            const criticalIds = criticalItems.map(i => i.id)

            if (where.id) {
                // If there's already an ID filter (unlikely here but good practice), we intersect
                // But since where.id is usually a string, we might need composite logic.
                // For now, we assume no other ID filter conflicts in findMany usage.
                // Actually safer to use AND
                where.AND = [
                    ...(Array.isArray(where.AND) ? where.AND : []),
                    { id: { in: criticalIds } }
                ]
            } else {
                where.id = { in: criticalIds }
            }
        }

        const [items, totalCount] = await Promise.all([
            prisma.item.findMany({
                where,
                skip,
                take: limit,
                orderBy: {
                    name: 'asc'
                }
            }),
            prisma.item.count({
                where
            })
        ])

        return {
            items,
            meta: {
                totalCount,
                perPage: limit,
                pageIndex: page
            }
        }
    }
    async update(data: Prisma.ItemUpdateInput, tx?: Prisma.TransactionClient): Promise<Item> {
        const client = tx ?? prisma
        const item = await client.item.update({
            where: {
                id: data.id as string
            },
            data
        })
        return item
    }
    async remove(id: string, tx?: Prisma.TransactionClient): Promise<void> {
        const client = tx ?? prisma
        await client.item.delete({
            where: {
                id
            }
        })
    }
    async changeStock(id: string, stock: number, operationType: boolean, tx?: Prisma.TransactionClient): Promise<void> {
        const client = tx ?? prisma

        await client.item.update({
            where: { id },
            data: {
                stock: operationType ? { increment: stock } : { decrement: stock }
            }
        })
    }
    async setActive(id: string, commutator: boolean, tx?: Prisma.TransactionClient): Promise<void> {
        const client = tx ?? prisma
        const findedStock = await client.item.findFirst({
            where: {
                id
            }
        })
        if (findedStock)
            await client.item.update({
                where: {
                    id
                },
                data: {
                    active: commutator
                }
            })
    }

    async findMaxDisplayId(): Promise<number> {
        const item = await prisma.item.findFirst({
            orderBy: {
                // @ts-ignore
                display_id: 'desc'
            }
        })
        return (item as any)?.display_id ?? 0
    }

    async findNextAvailableDisplayId(tx?: Prisma.TransactionClient): Promise<number> {
        const client = tx ?? prisma

        // 1. Check if ID 1 exists
        const first = await client.item.findUnique({
            where: { display_id: 1 }
        })

        if (!first) return 1

        // 2. Find the first gap using raw query
        // "SELECT (t1.display_id + 1) as next_id FROM items t1 LEFT JOIN items t2 ON t1.display_id + 1 = t2.display_id WHERE t2.display_id IS NULL ORDER BY t1.display_id ASC LIMIT 1"
        const result = await client.$queryRaw<{ next_id: number }[]>`
            SELECT (t1.display_id + 1) as next_id 
            FROM items t1 
            LEFT JOIN items t2 ON t1.display_id + 1 = t2.display_id 
            WHERE t2.display_id IS NULL 
            ORDER BY t1.display_id ASC 
            LIMIT 1
        `

        if (result.length > 0) {
            return result[0].next_id
        }

        // If no gaps found (unlikely given loop logic, but usually means table is fully sequential)
        // Return max + 1
        const max = await this.findMaxDisplayId()
        return max + 1
    }
}
