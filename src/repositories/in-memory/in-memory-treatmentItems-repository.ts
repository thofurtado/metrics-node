import { TreatmentItem, Prisma } from '@prisma/client'
import { TreatmentItemsRepository } from '../treatmentItems-repository'
import { randomUUID } from 'node:crypto'





export class InMemoryTreatmentItemsRepository implements TreatmentItemsRepository {

    public items: TreatmentItem[] = []
    async remove(id: string): Promise<void> {
        const index = this.items.findIndex((item) => item.id === id)

        if (index !== -1) {
            this.items.splice(index, 1) // Remove the item at the found index
        } else {
            throw new Error(`Treatment item with ID ${id} not found`) // Throw error for missing item
        }
    }
    async findById(id: string): Promise<{ id: string; item_id: string; treatment_id: string; stock_id: string | null; quantity: number; salesValue: number | null } | null> {
        const foundItem = this.items.find((item) => item.id === id)
        return foundItem ? { ...foundItem } : null // Return a copy to avoid mutation
    }
    async create(data: Prisma.TreatmentItemUncheckedCreateInput): Promise<TreatmentItem> {
        const treatmentItem = {
            id: randomUUID(),
            item_id: data.item_id,
            treatment_id: data.treatment_id,
            stock_id: data.stock_id || null,
            quantity: data.quantity,
            salesValue: data.salesValue || null
        }
        this.items.push(treatmentItem)
        return treatmentItem
    }
    async findByTreatment(treatment_id: string): Promise<TreatmentItem[] | null> {
        const treatmentItems = this.items.filter((item) => item.treatment_id === treatment_id)
        return treatmentItems.length ? treatmentItems : null
    }
    async linkStock(id: string, stock_id: string): Promise<void> {
        const index = this.items.findIndex(item => item.id === id)
        this.items[index].stock_id = stock_id
    }
    async update(data: Prisma.TreatmentItemUpdateInput): Promise<{ id: string; item_id: string; treatment_id: string; stock_id: string; quantity: number; salesValue: number | null }> {
        throw new Error('Method not implemented.')
    }
    async delete(id: string): Promise<void> {
        const index = this.items.findIndex((item) => item.id === id)
        if (index !== -1) {
            this.items.splice(index, 1)
        } else {
            throw new Error(`Treatment item with ID ${id} not found`)
        }
    }
}


