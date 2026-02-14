import { prisma } from '@/lib/prisma'
import { Prisma, ItemType } from '@prisma/client'
import { ItemsRepository, ItemWithExtensions, ItemUpdateInput, ItemCreateInput } from '@/modules/items/repositories/items-repository'
import { GetItemsDTO } from '@/modules/items/repositories/DTO/get-items-dto'

// ItemType is now defined in items-repository.ts but we can use Prisma's too if compatible.
// However, since we defined ItemType in items-repository, let's stick to using Prisma types where possible for DB operations
// But interface demands ItemType from repo definition which matches Prisma's string union.

export class PrismaItemsRepository implements ItemsRepository {

    async update(data: ItemUpdateInput, tx?: Prisma.TransactionClient): Promise<ItemWithExtensions> {
        const prismaClient = tx || prisma as Prisma.TransactionClient // Cast to ensure compatibility if needed

        // We need to determine WHICH table to update based on Type.
        // Data has ID and Type.

        const { id, type, ...updateData } = data

        // Polymorphic update is tricky with Prisma since we don't have a single 'Item' table anymore?
        // Wait, did we REVERT to single Item table?
        // Checking schema... schema says Product, Service, Supply are separate models.
        // THERE IS NO 'Item' MODEL IN SCHEMA anymore based on recent refactors (implied).
        // BUT the Interface implies a unified 'Item' return.

        // Actually, looking at 'prisma-items-repository.spec.ts' in the error log context...
        // it tried to import from here.

        // If specific repositories exist (PrismaProductsRepository, etc.), this 'ItemsRepository' might be an Aggregator or a remnant.
        // However, the error says 'Could not resolve .../prisma-items-repository'.
        // This file was missing. I am creating it now.

        // Implementation Strategy:
        // Since we have separate tables, 'ItemsRepository' acting as a Unified interface must delegate or switch on 'type'.

        // Helper to normalize result to ItemWithExtensions
        const normalize = (record: any, type: ItemType): ItemWithExtensions => {
            return {
                id: record.id,
                name: record.name,
                description: record.description,
                category: typeof record.category === 'string' ? record.category : record.category?.name, // Handler for relation vs string
                active: record.active,
                created_at: record.created_at,
                updated_at: record.updated_at,
                type: type,
                product: type === 'PRODUCT' ? record : null,
                service: type === 'SERVICE' ? record : null,
                supply: type === 'SUPPLY' ? record : null
            }
        }

        if (type === 'PRODUCT') {
            const updated = await prismaClient.product.update({
                where: { id },
                data: updateData as Prisma.ProductUpdateInput,
                include: { category: true, compositions: { include: { supply: true } } }
            })
            return normalize(updated, 'PRODUCT')
        } else if (type === 'SERVICE') {
            const updated = await prismaClient.service.update({
                where: { id },
                data: updateData as Prisma.ServiceUpdateInput,
                include: { compositions: { include: { supply: true } } }
            })
            return normalize(updated, 'SERVICE')
        } else if (type === 'SUPPLY') {
            const updated = await prismaClient.supply.update({
                where: { id },
                data: updateData as Prisma.SupplyUpdateInput
            })
            return normalize(updated, 'SUPPLY')
        }

        throw new Error('Invalid Item Type')
    }

    async create(data: ItemCreateInput, tx?: Prisma.TransactionClient): Promise<ItemWithExtensions> {
        const prismaClient = tx || prisma

        // Delegate to specific create based on union type discrimination
        if (data.type === 'PRODUCT') {
            const { type, ...createData } = data
            // Need to handle relation creation if nested... or just flat data?
            // The input type is intersection with Prisma.ProductCreateInput.
            const created = await prismaClient.product.create({
                data: createData as Prisma.ProductCreateInput,
                include: { category: true, compositions: { include: { supply: true } } }
            })
            return this.normalize(created, 'PRODUCT')

        } else if (data.type === 'SERVICE') {
            const { type, ...createData } = data
            const created = await prismaClient.service.create({
                data: createData as Prisma.ServiceCreateInput,
                include: { compositions: { include: { supply: true } } }
            })
            return this.normalize(created, 'SERVICE')

        } else if (data.type === 'SUPPLY') {
            const { type, ...createData } = data
            const created = await prismaClient.supply.create({
                data: createData as Prisma.SupplyCreateInput
            })
            return this.normalize(created, 'SUPPLY')
        }
        throw new Error('Invalid Item Type')
    }

    async findByName(name: string, is_active?: boolean): Promise<ItemWithExtensions[] | null> {
        // This is expensive as it needs to query 3 tables and merge?
        // Or do we assume unique names across all?
        // Let's query all 3 and merge results.

        const where: any = {
            name: { contains: name, mode: 'insensitive' }
        }
        if (is_active !== undefined) where.active = is_active;

        const [products, services, supplies] = await Promise.all([
            prisma.product.findMany({ where, include: { category: true, compositions: { include: { supply: true } } } }),
            prisma.service.findMany({ where, include: { compositions: { include: { supply: true } } } }),
            prisma.supply.findMany({ where })
        ])

        const results = [
            ...products.map(p => this.normalize(p, 'PRODUCT')),
            ...services.map(s => this.normalize(s, 'SERVICE')),
            ...supplies.map(s => this.normalize(s, 'SUPPLY'))
        ]

        return results.length > 0 ? results : null
    }

    async findById(id: string): Promise<ItemWithExtensions | null> {
        // Try finding in all tables... inefficient but necessary without a central Item table.
        // Order by likelihood?

        const product = await prisma.product.findUnique({
            where: { id },
            include: { category: true, compositions: { include: { supply: true } } }
        })
        if (product) return this.normalize(product, 'PRODUCT')

        const service = await prisma.service.findUnique({
            where: { id },
            include: { compositions: { include: { supply: true } } }
        })
        if (service) return this.normalize(service, 'SERVICE')

        const supply = await prisma.supply.findUnique({ where: { id } })
        if (supply) return this.normalize(supply, 'SUPPLY')

        return null
    }

    async findMany(is_active?: boolean, type?: ItemType | ItemType[], pageIndex = 1, perPage = 20, name?: string, display_id?: number, below_min_stock?: boolean): Promise<GetItemsDTO | null> {
        // This function is complex with 3 separate tables.
        // Pagination across 3 tables is hard.
        // USUALLY 'findMany' in this context is used with a specific type filter or for a unified list.
        // If type is ARRAY or undefined, we might need to fetch all matches and paginate in memory (bad for huge datasets) or advanced SQL UNION.

        // Given the constraints and likely usage, let's implement a simplified version or a UNION query if possible with Prisma $queryRaw?
        // Or fetch perPage number from EACH and merge/sort/slice?

        // Allow explicit type filtering to optimize
        const typesToFetch = Array.isArray(type) ? type : (type ? [type] : ['PRODUCT', 'SERVICE', 'SUPPLY']);

        // Build Where clauses
        const buildWhere = (t: ItemType) => {
            const where: any = {}
            if (is_active !== undefined) where.active = is_active;
            if (name) where.name = { contains: name, mode: 'insensitive' };
            if (display_id && (t === 'PRODUCT' || t === 'SERVICE')) where.display_id = display_id;
            if (below_min_stock && t === 'PRODUCT') {
                where.stock = { lte: prisma.product.fields.min_stock } // This might not work directly in where object for field comparison
                // Prisma validation limitation: comparing two fields in where is not directly supported in standard API, needs raw or specialized extension.
                // For now, let's ignore field-to-field comparison in standard findMany or handle post-fetch if dataset small.
                // Or better: don't support below_min_stock in this generic repo if not critical.
            }
            return where;
        }

        // naive implementation: standard fetch
        let allItems: ItemWithExtensions[] = []

        if (typesToFetch.includes('PRODUCT')) {
            const res = await prisma.product.findMany({ where: buildWhere('PRODUCT'), include: { category: true, compositions: { include: { supply: true } } } })
            allItems.push(...res.map(i => this.normalize(i, 'PRODUCT')))
        }
        if (typesToFetch.includes('SERVICE')) {
            const res = await prisma.service.findMany({ where: buildWhere('SERVICE'), include: { compositions: { include: { supply: true } } } })
            allItems.push(...res.map(i => this.normalize(i, 'SERVICE')))
        }
        if (typesToFetch.includes('SUPPLY')) {
            const res = await prisma.supply.findMany({ where: buildWhere('SUPPLY') })
            allItems.push(...res.map(i => this.normalize(i, 'SUPPLY')))
        }

        // Post-filter for field comparisons if needed
        if (below_min_stock) {
            allItems = allItems.filter(i => i.type === 'PRODUCT' && i.product && (i.product.stock ?? 0) <= (i.product.min_stock ?? 0))
        }

        const totalCount = allItems.length

        // Manual Pagination
        const start = (pageIndex - 1) * perPage
        const paginated = allItems.slice(start, start + perPage)

        if (paginated.length === 0) return null

        return {
            items: paginated,
            meta: {
                totalCount,
                pageIndex,
                perPage
            }
        }
    }

    async remove(id: string, tx?: Prisma.TransactionClient): Promise<void> {
        const prismaClient = tx || prisma
        // Try delete on all tables? Or find first?
        // Find first to know type is safer.
        const item = await this.findById(id)
        if (!item) throw new Error('Item not found')

        if (item.type === 'PRODUCT') await prismaClient.product.delete({ where: { id } })
        else if (item.type === 'SERVICE') await prismaClient.service.delete({ where: { id } })
        else if (item.type === 'SUPPLY') await prismaClient.supply.delete({ where: { id } })
    }

    async changeStock(id: string, stock: number, operationType: boolean, tx?: Prisma.TransactionClient, cost?: number): Promise<void> {
        const prismaClient = tx || prisma as Prisma.TransactionClient
        const item = await this.findById(id)
        if (!item) throw new Error('Item not found')

        const isIncrement = operationType;
        const op = isIncrement ? { increment: stock } : { decrement: stock }

        if (item.type === 'PRODUCT') {
            await prismaClient.product.update({
                where: { id },
                data: { stock: op, ...(cost ? { cost } : {}) }
            })
        } else if (item.type === 'SUPPLY') {
            await prismaClient.supply.update({
                where: { id },
                data: { stock: op, ...(cost ? { cost } : {}) }
            })
        }
        // Services don't have stock
    }

    async setActive(id: string, commutator: boolean, tx?: Prisma.TransactionClient): Promise<void> {
        const prismaClient = tx || prisma as Prisma.TransactionClient
        const item = await this.findById(id)
        if (!item) throw new Error('Item not found')

        const data = { active: commutator }
        if (item.type === 'PRODUCT') await prismaClient.product.update({ where: { id }, data })
        else if (item.type === 'SERVICE') await prismaClient.service.update({ where: { id }, data })
        else if (item.type === 'SUPPLY') await prismaClient.supply.update({ where: { id }, data })
    }

    async findMaxDisplayId(type: ItemType): Promise<number> {
        if (type === 'PRODUCT') {
            const agg = await prisma.product.aggregate({ _max: { display_id: true } })
            return agg._max.display_id || 0
        }
        if (type === 'SERVICE') {
            const agg = await prisma.service.aggregate({ _max: { display_id: true } })
            return agg._max.display_id || 0
        }
        return 0
    }

    async findNextAvailableDisplayId(type: ItemType, tx?: Prisma.TransactionClient): Promise<number> {
        // Simple Max+1 implementation
        const max = await this.findMaxDisplayId(type)
        return max + 1
    }


    // Helper
    private normalize(record: any, type: ItemType): ItemWithExtensions {
        return {
            id: record.id,
            name: record.name,
            description: record.description,
            category: record.category ? (typeof record.category === 'string' ? record.category : record.category.name) : null,
            active: record.active,
            created_at: record.created_at,
            updated_at: record.updated_at,
            type: type,
            product: type === 'PRODUCT' ? record : null,
            service: type === 'SERVICE' ? record : null,
            supply: type === 'SUPPLY' ? record : null
        }
    }
}
