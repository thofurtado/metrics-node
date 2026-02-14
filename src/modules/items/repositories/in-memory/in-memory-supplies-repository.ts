import { Prisma, Supply } from '@prisma/client'
import { SuppliesRepository } from '../supplies-repository'
import { randomUUID } from 'node:crypto'

export class InMemorySuppliesRepository implements SuppliesRepository {
    public items: Supply[] = []

    async create(data: Prisma.SupplyCreateInput, tx?: Prisma.TransactionClient): Promise<Supply> {
        const supply: Supply = {
            id: randomUUID(),
            name: data.name,
            description: data.description ?? null,
            active: data.active ?? true,
            cost: data.cost as any,
            stock: data.stock ?? 0,
            unit: data.unit ?? 'UN',
            category: (data.category as any)?.connectOrCreate?.create?.name ?? null,
            created_at: new Date(),
            updated_at: new Date(),
        }
        this.items.push(supply)
        return supply
    }

    async findById(id: string): Promise<Supply | null> {
        const item = this.items.find(item => item.id === id)
        return item || null
    }

    async findByName(name: string): Promise<Supply | null> {
        const item = this.items.find(item => item.name === name)
        return item || null
    }

    async findMany(page: number, limit: number, query?: string, isActive?: boolean): Promise<{ items: Supply[], total: number }> {
        let filtered = this.items
        if (query) filtered = filtered.filter(item => item.name.includes(query))
        if (isActive !== undefined) filtered = filtered.filter(item => item.active === isActive)

        return {
            items: filtered.slice((page - 1) * limit, page * limit),
            total: filtered.length
        }
    }

    async update(id: string, data: Prisma.SupplyUpdateInput, tx?: Prisma.TransactionClient): Promise<Supply> {
        const index = this.items.findIndex(item => item.id === id)
        if (index === -1) throw new Error('Supply not found')

        const stored = this.items[index]
        const updated = {
            ...stored,
            name: typeof data.name === 'string' ? data.name : stored.name,
            active: typeof data.active === 'boolean' ? data.active : stored.active,
            cost: typeof data.cost === 'number' ? data.cost : stored.cost,
        }
        // @ts-ignore
        this.items[index] = updated
        return updated
    }

    async delete(id: string, tx?: Prisma.TransactionClient): Promise<void> {
        const index = this.items.findIndex(item => item.id === id)
        if (index !== -1) {
            this.items.splice(index, 1)
        }
    }

    async changeStock(id: string, stock: number, operationType: boolean, tx?: Prisma.TransactionClient, cost?: number): Promise<void> {
        const item = this.items.find(i => i.id === id)
        if (item) {
            if (operationType) item.stock += stock
            else item.stock -= stock
        }
    }
}
