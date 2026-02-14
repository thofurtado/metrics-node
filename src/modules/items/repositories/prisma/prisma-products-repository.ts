import { prisma } from '@/lib/prisma'
import { Prisma, Product } from '@prisma/client'
import { ProductsRepository, ProductWithCompositions } from '../products-repository'

export class PrismaProductsRepository implements ProductsRepository {
    async create(data: Prisma.ProductCreateInput, tx?: Prisma.TransactionClient): Promise<Product> {
        const client = tx ?? prisma
        return await client.product.create({ data })
    }

    async findById(id: string): Promise<ProductWithCompositions | null> {
        const product = await prisma.product.findUnique({
            where: { id },
            include: {
                compositions: {
                    include: { supply: true }
                }
            }
        })
        return product as ProductWithCompositions | null
    }

    async findByName(name: string): Promise<Product | null> {
        return await prisma.product.findFirst({
            where: { name: { equals: name, mode: 'insensitive' } }
        })
    }

    async findMany(page: number, limit: number, query?: string, displayId?: number, isActive?: boolean, belowMinStock?: boolean): Promise<{ items: Product[], total: number }> {
        const offset = (page - 1) * limit

        const where: Prisma.ProductWhereInput = {
            ...(isActive !== undefined ? { active: isActive } : {}),
            ...(query ? { name: { contains: query, mode: 'insensitive' } } : {}),
            ...(displayId ? { display_id: displayId } : {}),
            ...(belowMinStock ? { stock: { lte: prisma.product.fields.min_stock } } : {})
        }

        const [items, total] = await Promise.all([
            prisma.product.findMany({
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
            prisma.product.count({ where })
        ])

        return { items, total }
    }

    async update(id: string, data: Prisma.ProductUpdateInput, tx?: Prisma.TransactionClient): Promise<Product> {
        const client = tx ?? prisma
        return await client.product.update({
            where: { id },
            data
        })
    }

    async delete(id: string, tx?: Prisma.TransactionClient): Promise<void> {
        const client = tx ?? prisma
        await client.product.delete({
            where: { id }
        })
    }

    async findNextAvailableDisplayId(tx?: Prisma.TransactionClient): Promise<number> {
        const client = tx ?? prisma

        const first = await client.$queryRawUnsafe<any[]>(`SELECT display_id FROM "products" WHERE display_id = 1 LIMIT 1`)

        if (!first || first.length === 0) return 1

        const result = await client.$queryRawUnsafe<{ next_id: number }[]>(`
            SELECT (t1.display_id + 1) as next_id 
            FROM "products" t1 
            LEFT JOIN "products" t2 ON t1.display_id + 1 = t2.display_id 
            WHERE t2.display_id IS NULL 
            ORDER BY t1.display_id ASC 
            LIMIT 1
        `)

        if (result.length > 0) {
            return result[0].next_id
        }

        const prod = await prisma.product.findFirst({ orderBy: { display_id: 'desc' } })
        const max = prod?.display_id ?? 0
        return max + 1
    }

    async changeStock(id: string, quantity: number, operationType: boolean, tx?: Prisma.TransactionClient, cost?: number): Promise<void> {
        const client = tx ?? prisma

        const data: Prisma.ProductUpdateInput = {
            stock: operationType ? { increment: quantity } : { decrement: quantity }
        }

        if (cost !== undefined) {
            data.cost = cost
        }

        await client.product.update({
            where: { id },
            data
        })
    }
}
