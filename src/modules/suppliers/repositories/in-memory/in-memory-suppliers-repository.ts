import { SuppliersRepository } from '@/modules/suppliers/repositories/suppliers-repository'
import { Prisma, Supplier } from '@prisma/client'
import { randomUUID } from 'node:crypto'

export class InMemorySuppliersRepository implements SuppliersRepository {
    public items: Supplier[] = []

    async create(data: Prisma.SupplierCreateInput): Promise<Supplier> {
        const supplier = {
            id: data.id ?? randomUUID(),
            name: data.name,
            document: data.document ?? null,
            email: data.email ?? null,
            phone: data.phone ?? null,
            created_at: new Date(),
            updated_at: new Date(),
        }

        this.items.push(supplier)

        return supplier
    }

    async findById(id: string): Promise<Supplier | null> {
        const supplier = this.items.find(item => item.id === id)

        if (!supplier) {
            return null
        }

        return supplier
    }

    async findByName(name: string): Promise<Supplier | null> {
        const supplier = this.items.find(item => item.name === name)

        if (!supplier) {
            return null
        }

        return supplier
    }

    async findMany(page: number, perPage: number, query?: string): Promise<{ suppliers: Supplier[], count: number }> {
        const suppliers = this.items
            .filter(item => query ? item.name.includes(query) : true)
            .slice((page - 1) * perPage, page * perPage)

        return {
            suppliers,
            count: this.items.length
        }
    }

    async delete(id: string): Promise<void> {
        this.items = this.items.filter(item => item.id !== id)
    }

    async update(id: string, data: Prisma.SupplierUpdateInput): Promise<Supplier> {
        const itemIndex = this.items.findIndex(item => item.id === id)
        if (itemIndex >= 0) {
            this.items[itemIndex] = { ...this.items[itemIndex], ...(data as any) }
        }
        return this.items[itemIndex]
    }
}
