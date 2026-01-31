import { Prisma, ItemType } from '@prisma/client'
import { ItemsRepository, ItemWithExtensions } from '../items-repository'
import { GetItemsDTO } from '../DTO/get-items-dto'
import { randomUUID } from 'node:crypto'

export class InMemoryItemsRepository implements ItemsRepository {

    public items: ItemWithExtensions[] = []

    async update(data: Prisma.ItemUpdateInput, tx?: Prisma.TransactionClient): Promise<ItemWithExtensions> {
        const id = (data as any).id as string
        const index = this.items.findIndex((item) => item.id === id)

        if (index === -1) {
            throw new Error('Item not found.')
        }

        const currentItem = this.items[index]
        const d = data as any

        // Mimic Prisma nested update
        let product = currentItem.product
        let service = currentItem.service
        let supply = currentItem.supply

        if (d.product?.update) {
            product = { ...product, ...d.product.update }
        }
        if (d.service?.update) {
            service = { ...service, ...d.service.update }
        }
        if (d.supply?.update) {
            supply = { ...supply, ...d.supply.update }
        }

        const updatedItem = {
            ...currentItem,
            name: d.name ?? currentItem.name,
            description: d.description ?? currentItem.description,
            category: d.category ?? currentItem.category,
            active: d.active ?? currentItem.active,
            updated_at: new Date(),
            product,
            service,
            supply
        } as ItemWithExtensions

        this.items[index] = updatedItem
        return updatedItem
    }

    async create(data: Prisma.ItemCreateInput): Promise<ItemWithExtensions> {
        const id = randomUUID()
        const type = data.type || ItemType.PRODUCT

        let product = null
        let service = null
        let supply = null

        // Need to cast to any to access create prop easily as Prisma types are complex union types
        const d = data as any

        if (d.product?.create) {
            product = {
                id,
                ...d.product.create,
                stock: d.product.create.stock || 0,
                min_stock: d.product.create.min_stock || 0,
            }
        }
        if (d.service?.create) {
            service = { id, ...d.service.create }
        }
        if (d.supply?.create) {
            supply = { id, ...d.supply.create, stock: d.supply.create.stock || 0 }
        }

        const item: ItemWithExtensions = {
            id,
            name: data.name,
            description: data.description || null,
            category: data.category || null,
            active: data.active ?? true,
            type: type,
            created_at: new Date(),
            updated_at: new Date(),
            product: product as any, // casting to satisfy relation type (might expect null or object)
            service: service as any,
            supply: supply as any
        }
        this.items.push(item)
        return item
    }

    async findByName(name: string, is_active?: boolean): Promise<ItemWithExtensions[] | null> {
        let filteredItems = this.items.slice()

        if (is_active !== undefined) {
            filteredItems = filteredItems.filter((item) => item.active === is_active)
        }

        const lowercaseName = name.toLowerCase()
        filteredItems = filteredItems.filter((item) => item.name.toLowerCase().includes(lowercaseName))

        return filteredItems.length ? filteredItems : null
    }

    async findById(id: string): Promise<ItemWithExtensions | null> {
        const item = this.items.find((item) => item.id === id)
        return item || null
    }

    async findMany(is_active?: boolean, type?: ItemType, pageIndex = 1, perPage = 20, name?: string, display_id?: number, below_min_stock?: boolean): Promise<GetItemsDTO | null> {
        let filteredItems = this.items.slice()

        if (is_active !== undefined) {
            filteredItems = filteredItems.filter((item) => item.active === is_active)
        }

        if (type) {
            filteredItems = filteredItems.filter((item) => item.type === type)
        }

        if (name) {
            filteredItems = filteredItems.filter((item) => item.name.toLowerCase().includes(name.toLowerCase()))
        }

        if (display_id) {
            filteredItems = filteredItems.filter((item) => {
                if (item.type === ItemType.PRODUCT) return item.product?.display_id === display_id
                if (item.type === ItemType.SERVICE) return item.service?.display_id === display_id
                return false
            })
        }

        if (below_min_stock) {
            filteredItems = filteredItems.filter((item) => {
                if (item.type === ItemType.PRODUCT && item.product) {
                    return (item.product.stock ?? 0) <= (item.product.min_stock ?? 0)
                }
                return false
            })
        }

        const totalCount = filteredItems.length
        const start = (pageIndex - 1) * perPage
        const end = start + perPage
        const paginatedItems = filteredItems.slice(start, end)

        if (paginatedItems.length === 0) return null

        return {
            items: paginatedItems,
            meta: {
                totalCount,
                pageIndex,
                perPage
            }
        }
    }

    async remove(id: string, tx?: any): Promise<void> {
        const index = this.items.findIndex((item) => item.id === id)
        if (index !== -1) {
            this.items.splice(index, 1)
        } else {
            throw new Error(`Item with ID ${id} not found`)
        }
    }

    async changeStock(id: string, stock: number, operationType: boolean, tx?: any): Promise<void> {
        const index = this.items.findIndex((item) => item.id === id)
        if (index !== -1) {
            const item = this.items[index]
            if (item.type === ItemType.PRODUCT && item.product) {
                const current = item.product.stock ?? 0
                item.product.stock = operationType ? current + stock : current - stock
            } else if (item.type === ItemType.SUPPLY && item.supply) {
                const current = item.supply.stock ?? 0
                item.supply.stock = operationType ? current + stock : current - stock
            }
        } else {
            throw new Error(`Item with ID ${id} not found`)
        }
    }

    async setActive(id: string, commutator: boolean): Promise<void> {
        const index = this.items.findIndex((item) => item.id === id)
        if (index !== -1) {
            this.items[index].active = commutator
        } else {
            throw new Error(`Item with ID ${id} not found`)
        }
    }

    async findMaxDisplayId(type: ItemType): Promise<number> {
        const filtered = this.items.filter(i => i.type === type)
        if (filtered.length === 0) return 0

        let max = 0
        filtered.forEach(i => {
            let id = 0
            if (type === ItemType.PRODUCT) id = i.product?.display_id ?? 0
            if (type === ItemType.SERVICE) id = i.service?.display_id ?? 0
            if (id > max) max = id
        })
        return max
    }

    async findNextAvailableDisplayId(type: ItemType): Promise<number> {
        // Naive implementation for in-memory: just return max + 1
        // Or implement gap logic?
        // For simple testing, max + 1 is usually enough unless specifically testing gap filling.
        // Let's implement basic gap logic for rigor check?
        // No, keep it simple: max + 1.
        const maxId = await this.findMaxDisplayId(type)
        return maxId + 1
    }
}
