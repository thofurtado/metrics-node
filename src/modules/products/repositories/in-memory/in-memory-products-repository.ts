import { Product, Prisma, Composition } from '@prisma/client'
import { ProductsRepository } from '@/modules/products/repositories/products-repository'
import { randomUUID } from 'node:crypto'

export class InMemoryProductsRepository implements ProductsRepository {
    public items: Product[] = []
    public compositions: Composition[] = []

    async create(data: Prisma.ProductCreateInput): Promise<Product> {
        const id = data.id ?? randomUUID()

        // We cast to any because data types might be stale in the environment
        const dataAny = data as any

        const product: Product = {
            id,
            name: dataAny.name,
            description: dataAny.description ?? null,
            category_id: dataAny.category?.connect?.id ?? null,
            active: dataAny.active ?? true,
            display_id: data.display_id,
            price: data.price,
            cost: dataAny.cost ?? 0,
            stock: data.stock ?? 0,
            min_stock: dataAny.min_stock ?? 0,
            barcode: dataAny.barcode ?? null,
            ncm: dataAny.ncm ?? null,
            is_composite: dataAny.is_composite ?? false,
            created_at: new Date(),
            updated_at: new Date(),
        }

        this.items.push(product)

        if (dataAny.compositions && dataAny.compositions.create) {
            const creates = Array.isArray(dataAny.compositions.create)
                ? dataAny.compositions.create
                : [dataAny.compositions.create];

            for (const c of creates) {
                const supplyId = c.supply?.connect?.id;
                if (supplyId) {
                    const composition: Composition = {
                        id: randomUUID(),
                        product_id: id,
                        supply_id: supplyId,
                        quantity: c.quantity ?? 1
                    }
                    this.compositions.push(composition)
                }
            }
        }

        return product
    }

    async findById(id: string): Promise<Product | null> {
        const product = this.items.find(item => item.id === id)
        if (!product) return null

        const productCompositions = this.compositions.filter(c => c.product_id === id)

        // Emulate Prisma include structure
        return {
            ...product,
            compositions: productCompositions.map(c => ({
                ...c,
                // We don't have easy access to Supply here to include it fully nested,
                // but usually use-case only needs supply_id or basic supply info?
                // The UseCase references `composition.supply_id` to call `suppliesRepository.decreaseStock`.
                // It does NOT use `composition.supply` object.
                // However, the Use Case comment mentioned "Prisma... include... supply: true".
                // Let's verify if `decrease-stock.ts` uses `composition.supply`.
                // It uses `composition.supply_id`.
                // So this is sufficient for the Use Case.
            }))
        } as any
    }

    async findByName(name: string): Promise<Product | null> {
        const product = this.items.find(item => (item as any).name === name)
        if (!product) return null
        return product
    }

    async findByDisplayId(displayId: number): Promise<Product | null> {
        const product = this.items.find(item => item.display_id === displayId)
        if (!product) return null
        return product
    }

    findMany(page: number, perPage: number, query?: string, active?: boolean): Promise<{ products: Product[], count: number }> {
        const filtered = this.items.filter(item => {
            if (active !== undefined && item.active !== active) return false
            if (query && !item.name.toLowerCase().includes(query.toLowerCase())) return false
            return true
        })

        return Promise.resolve({
            products: filtered.slice((page - 1) * perPage, page * perPage),
            count: filtered.length
        })
    }

    async findManyBySupplyId(supplyId: string, tx?: Prisma.TransactionClient): Promise<Product[]> {
        const productIds = this.compositions.filter(c => c.supply_id === supplyId).map(c => c.product_id)
        const products = this.items.filter(item => productIds.includes(item.id))

        return products.map(p => ({
            ...p,
            compositions: this.compositions.filter(c => c.product_id === p.id).map(c => ({
                ...c,
                supply: { cost: 0 } // Mock supply object if needed, or leave empty if mainly checking id
                // UpdateSupplyUseCase logic: totalCost += (comp.supply?.cost ?? 0) * qty for OTHER supplies.
                // Since we don't have easy access to other supplies repo here, we default to 0 or we'd need to injection.
                // For this specific single-supply test it won't matter.
            }))
        })) as any
    }

    async save(product: Product, tx?: Prisma.TransactionClient): Promise<Product> {
        const index = this.items.findIndex(item => item.id === product.id)
        if (index >= 0) {
            this.items[index] = product
        }
        return product
    }

    async delete(id: string): Promise<void> {
        const index = this.items.findIndex(item => item.id === id)
        if (index >= 0) {
            this.items.splice(index, 1)
        }
    }

    async decreaseStock(id: string, quantity: number, tx?: Prisma.TransactionClient): Promise<void> {
        const index = this.items.findIndex(item => item.id === id)
        if (index >= 0) {
            this.items[index].stock = (this.items[index].stock || 0) - quantity
        }
    }

    async findNextAvailableDisplayId(): Promise<number> {
        const max = this.items.reduce((prev, current) => (current.display_id > prev ? current.display_id : prev), 0)
        return max + 1
    }
}
