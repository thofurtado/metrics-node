import { Prisma, Product, Composition, Supply } from '@prisma/client'
import { ProductsRepository, ProductWithCompositions } from '../products-repository'
import { randomUUID } from 'node:crypto'

export class InMemoryProductsRepository implements ProductsRepository {
    public items: ProductWithCompositions[] = []

    async create(data: Prisma.ProductCreateInput, tx?: Prisma.TransactionClient): Promise<Product> {
        const product: ProductWithCompositions = {
            id: randomUUID(),
            name: data.name,
            description: data.description ?? null,
            active: data.active ?? true,
            price: data.price as any,
            min_stock: data.min_stock ?? 0,
            stock: data.stock ?? 0,
            barcode: data.barcode ?? null,
            category: (data.category as any)?.connectOrCreate?.create?.name ?? (data.category as any)?.create?.name ?? null,
            display_id: data.display_id ?? 0,
            ncm: data.ncm ?? null,
            is_composite: data.is_composite ?? false,
            created_at: new Date(),
            updated_at: new Date(),
            compositions: []
        }
        this.items.push(product)
        return product
    }

    async findById(id: string): Promise<ProductWithCompositions | null> {
        const item = this.items.find(item => item.id === id)
        return item || null
    }

    async findByName(name: string): Promise<Product | null> {
        const item = this.items.find(item => item.name === name)
        return item || null
    }

    async findMany(page: number, limit: number, query?: string, displayId?: number, isActive?: boolean, belowMinStock?: boolean): Promise<{ items: Product[], total: number }> {
        let filtered = this.items

        if (query) {
            filtered = filtered.filter(item => item.name.includes(query))
        }

        if (isActive !== undefined) {
            filtered = filtered.filter(item => item.active === isActive)
        }

        // Logic for display_id and below_min_stock if needed for tests

        return {
            items: filtered.slice((page - 1) * limit, page * limit),
            total: filtered.length
        }
    }

    async update(id: string, data: Prisma.ProductUpdateInput, tx?: Prisma.TransactionClient): Promise<Product> {
        const index = this.items.findIndex(item => item.id === id)
        if (index === -1) throw new Error('Product not found')

        const stored = this.items[index]

        // Simple update logic
        const updated = {
            ...stored,
            name: typeof data.name === 'string' ? data.name : stored.name,
            active: typeof data.active === 'boolean' ? data.active : stored.active,
            // Add other fields as necessary for tests
            stock: typeof data.stock === 'number' ? data.stock : stored.stock,
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

    async changeStock(id: string, stock: number, operationType: boolean, tx?: Prisma.TransactionClient, cost?: number): Promise<void> {
        const item = this.items.find(i => i.id === id)
        if (item) {
            if (operationType) item.stock += stock
            else item.stock -= stock
        }
    }
}
