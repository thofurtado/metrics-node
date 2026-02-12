import { TreatmentItem, Prisma } from '@prisma/client'
import { TreatmentItemsRepository } from '@/modules/treatments/repositories/treatmentItems-repository'
import { randomUUID } from 'node:crypto'





export class InMemoryTreatmentItemsRepository implements TreatmentItemsRepository {
    public items: TreatmentItem[] = []

    async remove(id: string): Promise<void> {
        const index = this.items.findIndex((item) => item.id === id)

        if (index !== -1) {
            this.items.splice(index, 1)
        } else {
            throw new Error(`Treatment item with ID ${id} not found`)
        }
    }

    async findById(id: string) {
        const foundItem = this.items.find((item) => item.id === id)
        return foundItem || null
    }

    async create(data: Prisma.TreatmentItemUncheckedCreateInput): Promise<TreatmentItem & { product: any, service: any, supply: any }> {
        const treatmentItem: TreatmentItem & { product: any, service: any, supply: any } = {
            id: randomUUID(),
            item_id: data.item_id || '',
            treatment_id: data.treatment_id,
            stock_id: data.stock_id || null,
            quantity: data.quantity,
            salesValue: data.salesValue || null,
            product_id: data.product_id || null,
            service_id: data.service_id || null,
            supply_id: data.supply_id || null,
            discount: data.discount ? Number(data.discount) : null,
            created_at: new Date(),
            updated_at: new Date(),
            product: null,
            service: null,
            supply: null
        }
        this.items.push(treatmentItem)
        return treatmentItem
    }

    async findByTreatment(treatment_id: string): Promise<TreatmentItem[] | null> {
        const treatmentItems = this.items.filter((item) => item.treatment_id === treatment_id)
        return treatmentItems.length ? treatmentItems : null
    }

    async findByTreatmentAndItemId(
        treatment_id: string,
        product_id?: string,
        service_id?: string,
        supply_id?: string
    ): Promise<TreatmentItem | null> {
        const item = this.items.find(item => {
            const sameTreatment = item.treatment_id === treatment_id
            if (!sameTreatment) return false

            if (product_id) return item.product_id === product_id
            if (service_id) return item.service_id === service_id
            if (supply_id) return item.supply_id === supply_id

            return false
        })
        return item || null
    }

    async linkStock(id: string, stock_id: string): Promise<void> {
        const index = this.items.findIndex(item => item.id === id)
        if (index >= 0) {
            this.items[index].stock_id = stock_id
        }
    }

    async update(data: any): Promise<TreatmentItem & { product: any, service: any, supply: any }> {
        const index = this.items.findIndex(item => item.id === data.id)
        if (index === -1) throw new Error('Item not found')

        this.items[index] = {
            ...this.items[index],
            ...data,
            quantity: data.quantity || this.items[index].quantity,
            salesValue: data.salesValue || this.items[index].salesValue,
            discount: data.discount || this.items[index].discount
        }
        return {
            ...this.items[index],
            product: null,
            service: null,
            supply: null
        }
    }

    async delete(id: string): Promise<void> {
        await this.remove(id)
    }
}


