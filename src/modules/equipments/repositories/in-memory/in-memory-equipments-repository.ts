import {Equipment, Prisma} from '@prisma/client'
import { randomUUID } from 'node:crypto'
import { EquipmentsRepository } from '@/modules/equipments/repositories/equipments-repository'

export class InMemoryEquipmentsRepository implements EquipmentsRepository {


    public items: Equipment[] = []
    async findByClient(client_id: string): Promise<{ id: string; client_id: string; type: string; brand: string | null; identification: string | null; details: string | null; entry: Date }[] | null> {
        const equipments = this.items.filter(item => item.client_id === client_id)
        return equipments.length ? equipments : null
    }
    async findMany(type?: string | undefined, brand?: string | undefined, identification?: string | undefined): Promise<{ id: string; client_id: string; type: string; brand: string | null; identification: string | null; details: string | null; entry: Date }[] | null> {
        let filteredEquipments = this.items.slice()

        if(type !== undefined) {
            filteredEquipments = filteredEquipments.filter(item => item.type === type)
        }
        if(brand !== undefined) {
            filteredEquipments = filteredEquipments.filter(item => item.brand === brand)
        }
        if(identification !== undefined) {
            filteredEquipments = filteredEquipments.filter(item => item.identification === identification)
        }
        return filteredEquipments.length ? filteredEquipments : null
    }

    async findById(id: string) {
        const equipment = this.items.find(item => item.id === id)

        if(!equipment){
            return null
        }
        return equipment
    }
    async findByClientId(client_id: string){
        const equipment = this.items.filter(item => item.client_id === client_id)

        if(!equipment){
            return null
        }
        return equipment
    }
    async create(data: Prisma.EquipmentUncheckedCreateInput){
        const equipment = {
            id: randomUUID(),
            client_id: data.client_id,
            type: data.type,
            brand: data.brand ?? null,
            identification: data.identification ?? null,
            details: data.details ?? null,
            entry: new Date(data.entry),
        }
        this.items.push(equipment)
        return equipment
    }

    async update(id: string, data: Prisma.EquipmentUpdateInput): Promise<Equipment> {
        const index = this.items.findIndex(item => item.id === id)
        if (index === -1) throw new Error('Equipment not found')
        const current = this.items[index]
        const updated: any = {
            ...current,
            type: (data.type as string) || current.type,
            brand: data.brand !== undefined ? (data.brand as string | null) : current.brand,
            identification: data.identification !== undefined ? (data.identification as string | null) : current.identification,
            details: data.details !== undefined ? (data.details as string | null) : current.details,
            client_id: data.client !== undefined ? (data.client as any)?.connect?.id || null : current.client_id,
        }
        this.items[index] = updated
        return this.items[index]
    }

    async delete(id: string): Promise<void> {
        const index = this.items.findIndex(item => item.id === id)
        if (index !== -1) {
            this.items.splice(index, 1)
        }
    }
}
