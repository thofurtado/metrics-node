import { Item, Prisma } from '@prisma/client'
import { ItemsRepository } from '../items-repository'
import { GetItemsDTO } from '../DTO/get-items-dto'
import { randomUUID } from 'node:crypto'


export class InMemoryItemsRepository implements ItemsRepository {

    public items: Item[] = []

    async update(data: Prisma.ItemUpdateInput, tx?: Prisma.TransactionClient): Promise<Item> {
        const id = (data as any).id as string
        const index = this.items.findIndex((item) => item.id === id)

        if (index === -1) {
            throw new Error('Item not found.')
        }

        const item = this.items[index]

        const updatedItem = {
            ...item,
            ...data,
        } as unknown as Item

        this.items[index] = updatedItem

        return updatedItem
    }

    async create(data: Prisma.ItemUncheckedCreateInput) {
        const item: Item = {
            id: randomUUID(),
            name: data.name,
            description: data.description ? data.description : null,
            cost: data.cost,
            price: data.price,
            stock: data.stock !== undefined && data.stock !== null ? data.stock : 0,
            min_stock: data.min_stock !== undefined && data.min_stock !== null ? data.min_stock : 0,
            active: data.active !== undefined && data.active !== null ? data.active : true,
            isItem: data.isItem !== undefined && data.isItem !== null ? data.isItem : true,
            display_id: data.display_id || 1,
            barcode: data.barcode || null,
            category: data.category || null,
        }
        this.items.push(item)
        return item
    }

    async findByName(name: string, is_active?: boolean): Promise<Item[] | null> {
        let filteredItems = this.items.slice()

        if (is_active !== undefined) {
            filteredItems = filteredItems.filter((item) => item.active === is_active)
        }

        const lowercaseName = name.toLowerCase()
        filteredItems = filteredItems.filter((item) => item.name.toLowerCase().includes(lowercaseName))

        return filteredItems.length ? filteredItems : null
    }

    async findById(id: string): Promise<Item | null> {
        const item = this.items.find((item) => item.id === id)
        return item || null
    }

    async findMany(is_active?: boolean, is_product?: boolean, pageIndex = 1, perPage = 20, name?: string, display_id?: number, below_min_stock?: boolean): Promise<GetItemsDTO | null> {
        let filteredItems = this.items.slice()

        if (is_active !== undefined) {
            filteredItems = filteredItems.filter((item) => item.active === is_active)
        }

        if (is_product !== undefined) {
            filteredItems = filteredItems.filter((item) => item.isItem === is_product)
        }

        if (name) {
            filteredItems = filteredItems.filter((item) => item.name.toLowerCase().includes(name.toLowerCase()))
        }

        if (display_id) {
            filteredItems = filteredItems.filter((item) => item.display_id === display_id)
        }

        // Simulating pagination
        const totalCount = filteredItems.length

        // In this mock we are not strictly paginating the array returned unless requested, 
        // but for DTO we assume full return matches expectation or we slice it.
        // Let's slice it to be correct
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


    async remove(id: string): Promise<void> {
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
            const currentStock = this.items[index].stock ?? 0
            if (operationType) {
                this.items[index].stock = currentStock + stock
            } else {
                this.items[index].stock = currentStock - stock
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

    async findMaxDisplayId(): Promise<number> {
        if (this.items.length === 0) {
            return 0
        }
        const maxId = Math.max(...this.items.map(item => item.display_id))
        return maxId
    }

    async findNextAvailableDisplayId(): Promise<number> {
        const maxId = await this.findMaxDisplayId()
        return maxId + 1
    }
}
