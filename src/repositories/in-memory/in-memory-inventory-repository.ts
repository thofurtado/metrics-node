// repositories/in-memory/in-memory-inventory-repository.ts
import { InventoryRepository, InventorySummaryData } from '../inventory-repository'
import { Item, Treatment, TreatmentItem } from '@prisma/client'

export class InMemoryInventoryRepository implements InventoryRepository {
    public items: Item[] = []
    public treatments: Treatment[] = []
    public treatmentItems: TreatmentItem[] = []

    async getInventorySummary(): Promise<InventorySummaryData> {
        const currentDate = new Date()
        const currentYear = currentDate.getFullYear()
        const currentMonth = currentDate.getMonth()
        const startOfMonth = new Date(currentYear, currentMonth, 1)
        const startOfNextMonth = new Date(currentYear, currentMonth + 1, 1)

        // 1. Patrimônio: soma de (stock * cost) para todos os produtos (isItem = true)
        const patrimony = this.items.reduce((sum, item) => {
            if (item.isItem && item.active !== false) {
                const itemStock = item.stock || 0
                const itemCost = item.cost || 0
                return sum + (itemStock * itemCost)
            }
            return sum
        }, 0)

        // 2. Filtrar TreatmentItems do mês atual
        const monthTreatmentItems = this.treatmentItems.filter(treatmentItem => {
            const treatment = this.treatments.find(t => t.id === treatmentItem.treatment_id)
            if (!treatment) return false

            const treatmentDate = new Date(treatment.opening_date)
            return treatmentDate >= startOfMonth && treatmentDate < startOfNextMonth
        })

        // 3. Valor Total de Produtos Vendidos: soma de (quantity * salesValue) para itens (isItem = true)
        const productsSoldValue = monthTreatmentItems.reduce((sum, treatmentItem) => {
            const item = this.items.find(i => i.id === treatmentItem.item_id)
            if (item?.isItem) {
                const quantity = treatmentItem.quantity || 0
                const salesValue = treatmentItem.salesValue || item.price || 0 // Usa salesValue ou price como fallback
                return sum + (quantity * salesValue)
            }
            return sum
        }, 0)

        // 4. Valor Total de Serviços Vendidos: soma de (quantity * salesValue) para serviços (isItem = false)
        const servicesSoldValue = monthTreatmentItems.reduce((sum, treatmentItem) => {
            const item = this.items.find(i => i.id === treatmentItem.item_id)
            if (item && item.isItem === false) {
                const quantity = treatmentItem.quantity || 0
                const salesValue = treatmentItem.salesValue || item.price || 0 // Usa salesValue ou price como fallback
                return sum + (quantity * salesValue)
            }
            return sum
        }, 0)

        return {
            patrimony,
            productsSold: productsSoldValue,
            servicesSold: servicesSoldValue
        }
    }

    // Métodos auxiliares para testes
    createItem(item: Partial<Item>): Item {
        const newItem: Item = {
            id: item.id || `item-${this.items.length + 1}`,
            name: item.name || 'Default Item',
            description: item.description || null,
            cost: item.cost || 0,
            price: item.price || 0,
            stock: item.stock || 0,
            active: item.active !== undefined ? item.active : true,
            isItem: item.isItem !== undefined ? item.isItem : true,
            ...item
        }

        this.items.push(newItem)
        return newItem
    }

    createTreatment(treatment: Partial<Treatment>): Treatment {
        const newTreatment: Treatment = {
            id: treatment.id || `treatment-${this.treatments.length + 1}`,
            opening_date: treatment.opening_date || new Date(),
            ending_date: treatment.ending_date || null,
            contact: treatment.contact || null,
            user_id: treatment.user_id || null,
            client_id: treatment.client_id || null,
            equipment_id: treatment.equipment_id || null,
            request: treatment.request || 'Default request',
            status: treatment.status || 'pending',
            amount: treatment.amount || 0,
            observations: treatment.observations || null,
            ...treatment
        }

        this.treatments.push(newTreatment)
        return newTreatment
    }

    createTreatmentItem(treatmentItem: Partial<TreatmentItem>): TreatmentItem {
        const newTreatmentItem: TreatmentItem = {
            id: treatmentItem.id || `treatment-item-${this.treatmentItems.length + 1}`,
            item_id: treatmentItem.item_id || 'item-1',
            treatment_id: treatmentItem.treatment_id || 'treatment-1',
            stock_id: treatmentItem.stock_id || null,
            quantity: treatmentItem.quantity || 0,
            salesValue: treatmentItem.salesValue || null,
            discount: treatmentItem.discount || null,
            ...treatmentItem
        }

        this.treatmentItems.push(newTreatmentItem)
        return newTreatmentItem
    }

    // Métodos auxiliares adicionais para limpar dados entre testes
    clearItems() {
        this.items = []
    }

    clearTreatments() {
        this.treatments = []
    }

    clearTreatmentItems() {
        this.treatmentItems = []
    }

    clearAll() {
        this.clearItems()
        this.clearTreatments()
        this.clearTreatmentItems()
    }
}