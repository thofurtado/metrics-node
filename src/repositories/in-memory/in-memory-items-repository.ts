import { Item, Prisma } from '@prisma/client'
import { ItemsRepository } from '../items-repository'
import { randomUUID } from 'node:crypto'




export class InMemoryItemsRepository implements ItemsRepository {

    public items: Item[] = []
    async update(data: Prisma.ItemUpdateInput): Promise<{ id: string; name: string; description: string | null; cost: number; price: number; stock: number; active: boolean; isItem: boolean }> {
        throw new Error('Method not implemented.')
    }
    async create(data: Prisma.ItemUncheckedCreateInput) {
        const item = {
            id: randomUUID(),
            name: data.name,
            description: data.description ? data.description : null,
            cost: data.cost,
            price: data.price,
            stock: data.stock ? data.stock : 0,
            active: data.active ? data.active : true,
            isItem: data.isItem ? data.isItem : true
        }
        this.items.push(item)
        return item
    }
    async findByName(name: string, is_active?: string | undefined): Promise<{ id: string; name: string; description: string | null; cost: number; price: number; stock: number; active: boolean; isItem: boolean }[] | null> {
        let filteredItems = this.items.slice() // Create a copy to avoid modifying original array

        if (is_active !== undefined) {
            filteredItems = filteredItems.filter((item) => item.active === (is_active === 'true')) // Convert string to boolean
        }

        const lowercaseName = name.toLowerCase()
        filteredItems = filteredItems.filter((item) => item.name.toLowerCase().includes(lowercaseName))

        // Implement approximate name search (replace with your preferred method)
        // Here's an example using Levenshtein distance for approximate matching:
        // https://en.wikipedia.org/wiki/Levenshtein_distance
        // You can find libraries that implement this algorithm.

        // filteredItems = filteredItems.filter(item => {
        //   const distance = levenshteinDistance(lowercaseName, item.name.toLowerCase());
        //   // Define a threshold for acceptable distance based on your needs
        //   return distance <= 2;  // Example threshold of maximum 2 character differences
        // });

        // Replace the above commented-out section with your chosen approximate search logic

        return filteredItems.length ? filteredItems : null
    }
    async findById(id: string): Promise<{ id: string; name: string; description: string | null; cost: number; price: number; stock: number; active: boolean; isItem: boolean } | null> {
        const item = this.items.find((item) => item.id === id)
        return item || null // Return item if found, null otherwise
    }

    async findMany(is_active?: boolean | undefined, is_product?: boolean | undefined): Promise<{ id: string; name: string; description: string | null; cost: number; price: number; stock: number; active: boolean; isItem: boolean }[] | null> {
        let filteredItems = this.items.slice() // Create a copy to avoid modifying original array

        if (is_active !== undefined) {
            filteredItems = filteredItems.filter((item) => item.active === is_active)
        }

        if (is_product !== undefined) {
            filteredItems = filteredItems.filter((item) => item.isItem === is_product)
        }

        return filteredItems.length ? filteredItems : null
    }


    async remove(id: string):Promise<void> {
        const index = this.items.findIndex((item) => item.id === id)
        if (index !== -1) {
            this.items.splice(index, 1)
        } else {
            throw new Error(`Item with ID ${id} not found`)
        }
    }

    async changeStock(id: string, stock: number):Promise<void> {
        const index = this.items.findIndex((item) => item.id === id)
        if (index !== -1) {
            this.items[index].stock += stock
        } else {
            throw new Error(`Item with ID ${id} not found`)
        }
    }

    async setActive(id: string, commutator: boolean):Promise<void> {
        const index = this.items.findIndex((item) => item.id === id)
        if (index !== -1) {
            this.items[index].active = commutator
        } else {
            throw new Error(`Item with ID ${id} not found`)
        }
    }
}
