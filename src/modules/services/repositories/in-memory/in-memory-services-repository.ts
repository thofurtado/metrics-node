import { Service, Prisma } from '@prisma/client'
import { ServicesRepository } from '@/modules/services/repositories/services-repository'
import { randomUUID } from 'node:crypto'

export class InMemoryServicesRepository implements ServicesRepository {
    public items: Service[] = []

    async create(data: Prisma.ServiceCreateInput): Promise<Service> {
        const id = data.id ?? randomUUID()
        const dataAny = data as any
        const service: Service = {
            id,
            name: dataAny.name,
            description: dataAny.description ?? null,
            category: dataAny.category ?? null,
            active: dataAny.active ?? true,
            display_id: data.display_id,
            price: data.price,
            estimated_time: data.estimated_time ?? null,
            created_at: new Date(),
            updated_at: new Date(),
        }

        this.items.push(service)
        return service
    }

    async findById(id: string): Promise<Service | null> {
        const service = this.items.find(item => item.id === id)
        if (!service) return null
        return service
    }

    async findByName(name: string): Promise<Service | null> {
        const service = this.items.find(item => (item as any).name === name)
        if (!service) return null
        return service
    }

    async findByDisplayId(displayId: number): Promise<Service | null> {
        const service = this.items.find(item => item.display_id === displayId)
        if (!service) return null
        return service
    }

    async findMany(page: number, perPage: number, query?: string): Promise<Service[]> {
        return this.items
            .filter(item => !query || (item as any).name.includes(query))
            .slice((page - 1) * perPage, page * perPage)
    }

    async save(service: Service): Promise<Service> {
        const index = this.items.findIndex(item => item.id === service.id)
        if (index >= 0) {
            this.items[index] = service
        }
        return service
    }

    async delete(id: string): Promise<void> {
        const index = this.items.findIndex(item => item.id === id)
        if (index >= 0) {
            this.items.splice(index, 1)
        }
    }

    async findNextAvailableDisplayId(): Promise<number> {
        const max = this.items.reduce((prev, current) => (current.display_id > prev ? current.display_id : prev), 0)
        return max + 1
    }
}
