import {Equipment, Prisma} from '@prisma/client'
import { randomUUID } from 'node:crypto'
import { EquipmentsRepository } from '../equipments-repository'

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
}
