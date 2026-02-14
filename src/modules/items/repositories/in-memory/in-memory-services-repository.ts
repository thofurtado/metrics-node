import { Prisma, Service } from '@prisma/client'
import { ServicesRepository } from '../services-repository'
import { randomUUID } from 'node:crypto'

export class InMemoryServicesRepository implements ServicesRepository {
    public items: Service[] = []

    async create(data: Prisma.ServiceCreateInput, tx?: Prisma.TransactionClient): Promise<Service> {
        const service: Service = {
            id: randomUUID(),
            name: data.name,
            description: data.description ?? null,
            active: data.active ?? true,
            price: data.price as any,
            category: (data.category as any)?.connectOrCreate?.create?.name ?? null,
            display_id: data.display_id ?? 0,
            estimated_time: data.estimated_time ?? null,
            created_at: new Date(),
            updated_at: new Date(),
        }
        this.items.push(service)
        return service
    }

    async findById(id: string): Promise<Service | null> {
        const item = this.items.find(item => item.id === id)
        return item || null
    }

    async findByName(name: string): Promise<Service | null> {
        const item = this.items.find(item => item.name === name)
        return item || null
    }

    async findMany(page: number, limit: number, query?: string, displayId?: number, isActive?: boolean): Promise<{ items: Service[], total: number }> {
        let filtered = this.items
        if (query) filtered = filtered.filter(item => item.name.includes(query))
        if (isActive !== undefined) filtered = filtered.filter(item => item.active === isActive)

        return {
            items: filtered.slice((page - 1) * limit, page * limit),
            total: filtered.length
        }
    }

    async update(id: string, data: Prisma.ServiceUpdateInput, tx?: Prisma.TransactionClient): Promise<Service> {
        const index = this.items.findIndex(item => item.id === id)
        if (index === -1) throw new Error('Service not found')

        const stored = this.items[index]
        const updated = {
            ...stored,
            name: typeof data.name === 'string' ? data.name : stored.name,
            active: typeof data.active === 'boolean' ? data.active : stored.active,
            price: typeof data.price === 'number' ? data.price : stored.price,
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

    async findNextAvailableDisplayId(tx?: Prisma.TransactionClient): Promise<number> {
        return this.items.length + 1
    }
}
