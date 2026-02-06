import { prisma } from '@/lib/prisma'
import { Item, Prisma, ItemType } from '@prisma/client'
import { ItemsRepository, ItemWithExtensions } from '../items-repository'
import { GetItemsDTO } from '../DTO/get-items-dto'

export class PrismaItemsRepository implements ItemsRepository {
    async create(data: Prisma.ItemCreateInput, tx?: Prisma.TransactionClient): Promise<ItemWithExtensions> {
        const client = tx ?? prisma
        const item = await client.item.create({
            data,
            include: {
                product: {
                    include: {
                        compositions: {
                            include: {
                                supply: true
                            }
                        }
                    }
                },
                service: true,
                supply: true
            }
        })
        return item
    }

    async findByName(name: string, is_active?: boolean | undefined): Promise<ItemWithExtensions[] | null> {
        let item
        const include = {
            product: {
                include: {
                    compositions: {
                        include: {
                            supply: true
                        }
                    }
                }
            },
            service: true,
            supply: true
        }

        if (is_active) {
            item = await prisma.item.findMany({
                where: {
                    AND: [
                        { name: name },
                        { active: is_active }
                    ]
                },
                include
            })
        }
        else {
            item = await prisma.item.findMany({
                where: {
                    name
                },
                include
            })
        }

        if (item.length === 0)
            return null
        return item
    }

    async findById(id: string): Promise<ItemWithExtensions | null> {
        // Fix: Manual search across tables since 'Item' model behaves as a view/union or is missing
        const product = await prisma.product.findUnique({
            where: { id },
            include: {
                compositions: {
                    include: { supply: true }
                }
            }
        })
        if (product) {
            return {
                ...product,
                type: 'PRODUCT',
                product: product,
                service: null,
                supply: null
            } as any
        }

        const service = await prisma.service.findUnique({ where: { id } })
        if (service) {
            return {
                ...service,
                type: 'SERVICE',
                product: null,
                service: service,
                supply: null
            } as any
        }

        const supply = await prisma.supply.findUnique({ where: { id } })
        if (supply) {
            return {
                ...supply,
                type: 'SUPPLY',
                product: null,
                service: null,
                supply: supply
            } as any
        }

        return null
    }

    async findMany(is_active?: boolean | undefined, type?: ItemType | ItemType[], pageIndex?: number, perPage?: number, name?: string, display_id?: number, below_min_stock?: boolean): Promise<GetItemsDTO | null> {
        const page = Math.max(1, pageIndex || 1)
        const limit = perPage || 10
        const skip = (page - 1) * limit

        const where: Prisma.ItemWhereInput = {}
        if (is_active !== undefined) where.active = is_active

        if (type) {
            if (Array.isArray(type)) {
                where.type = { in: type }
            } else {
                where.type = type
            }
        }

        if (name) where.name = { contains: name, mode: 'insensitive' }

        if (display_id) {
            where.OR = [
                { product: { display_id } },
                { service: { display_id } }
            ]
        }

        if (below_min_stock) {
            const criticalItems = await prisma.$queryRaw<{ id: string }[]>`
                SELECT id FROM products WHERE stock <= min_stock
             `
            const criticalIds = criticalItems.map(i => i.id)

            if (where.id) {
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
                },
                include: {
                    product: {
                        include: {
                            compositions: {
                                include: {
                                    supply: true
                                }
                            }
                        }
                    },
                    service: true,
                    supply: true
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

    async update(data: Prisma.ItemUpdateInput, tx?: Prisma.TransactionClient): Promise<ItemWithExtensions> {
        const client = tx ?? prisma
        const item = await client.item.update({
            where: {
                id: data.id as string
            },
            data,
            include: {
                product: {
                    include: {
                        compositions: {
                            include: {
                                supply: true
                            }
                        }
                    }
                },
                service: true,
                supply: true
            }
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

        const item = await client.item.findUnique({ where: { id } })
        if (!item) return

        if (item.type === 'PRODUCT') {
            await client.product.update({
                where: { id },
                data: {
                    stock: operationType ? { increment: stock } : { decrement: stock }
                }
            })
        } else if (item.type === 'SUPPLY') {
            await client.supply.update({
                where: { id },
                data: {
                    stock: operationType ? { increment: stock } : { decrement: stock }
                }
            })
        }
    }

    async setActive(id: string, commutator: boolean, tx?: Prisma.TransactionClient): Promise<void> {
        const client = tx ?? prisma
        await client.item.update({
            where: { id },
            data: { active: commutator }
        })
    }

    async findMaxDisplayId(type: ItemType): Promise<number> {
        if (type === 'PRODUCT') {
            const prod = await prisma.product.findFirst({ orderBy: { display_id: 'desc' } })
            return prod?.display_id ?? 0
        } else if (type === 'SERVICE') {
            const serv = await prisma.service.findFirst({ orderBy: { display_id: 'desc' } })
            return serv?.display_id ?? 0
        }
        return 0
    }

    async findNextAvailableDisplayId(type: ItemType, tx?: Prisma.TransactionClient): Promise<number> {
        const client = tx ?? prisma

        const tableName = type === 'PRODUCT' ? 'products' : type === 'SERVICE' ? 'services' : null

        if (!tableName) return 0;

        const first = await client.$queryRawUnsafe<any[]>(`SELECT display_id FROM "${tableName}" WHERE display_id = 1 LIMIT 1`)

        if (!first || first.length === 0) return 1

        const result = await client.$queryRawUnsafe<{ next_id: number }[]>(`
            SELECT (t1.display_id + 1) as next_id 
            FROM "${tableName}" t1 
            LEFT JOIN "${tableName}" t2 ON t1.display_id + 1 = t2.display_id 
            WHERE t2.display_id IS NULL 
            ORDER BY t1.display_id ASC 
            LIMIT 1
        `)

        if (result.length > 0) {
            return result[0].next_id
        }

        const max = await this.findMaxDisplayId(type)
        return max + 1
    }
}
