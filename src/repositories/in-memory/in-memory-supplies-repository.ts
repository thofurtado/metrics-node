import { Supply, Prisma } from '@prisma/client'
import { SuppliesRepository } from '@/repositories/supplies-repository'
import { randomUUID } from 'node:crypto'

export class InMemorySuppliesRepository implements SuppliesRepository {
    public items: Supply[] = []

    async create(data: Prisma.SupplyCreateInput): Promise<Supply> {
        const id = data.id ?? randomUUID()
        const dataAny = data as any
        const supply: Supply = {
            id,
            name: dataAny.name,
            description: dataAny.description ?? null,
            category: dataAny.category ?? null,
            active: dataAny.active ?? true,
            cost: data.cost,
            stock: data.stock ?? 0,
            unit: data.unit ?? null,
            created_at: new Date(),
            updated_at: new Date(),
        }

        this.items.push(supply)
        return supply
    }

    async findById(id: string, tx?: Prisma.TransactionClient): Promise<Supply | null> {
        const supply = this.items.find(item => item.id === id)
        if (!supply) return null
        return supply
    }

    async findByName(name: string): Promise<Supply | null> {
        const supply = this.items.find(item => (item as any).name === name)
        if (!supply) return null
        return supply
    }

    async findMany(page: number, perPage: number, query?: string): Promise<{ supplies: Supply[], count: number }> {
        const filtered = this.items.filter(item => !query || (item as any).name.includes(query))

        return {
            supplies: filtered.slice((page - 1) * perPage, page * perPage),
            count: filtered.length
        }
    }

    async save(supply: Supply, tx?: Prisma.TransactionClient): Promise<Supply> {
        const index = this.items.findIndex(item => item.id === supply.id)
        if (index >= 0) {
            this.items[index] = supply
        }
        return supply
    }

    async delete(id: string): Promise<void> {
        const index = this.items.findIndex(item => item.id === id)
        if (index >= 0) {
            this.items.splice(index, 1)
        }
    }

    async decreaseStock(id: string, quantity: number): Promise<void> {
        const index = this.items.findIndex(item => item.id === id)
        if (index >= 0) {
            this.items[index].stock = (this.items[index].stock || 0) - quantity
        }
    }
}
