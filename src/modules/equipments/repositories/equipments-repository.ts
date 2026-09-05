import {Prisma, Equipment} from '@prisma/client'

export interface EquipmentsRepository {
    create(data: Prisma.EquipmentUncheckedCreateInput):Promise<Equipment>
    findById(id:string): Promise<Equipment | null>
    findByClient(client_id:string): Promise<Equipment[] | null>
    findOrphans(): Promise<Equipment[]>
    findMany(type?:string, brand?:string, identification?:string):Promise<Equipment[] | null>
    update(id: string, data: Prisma.EquipmentUpdateInput): Promise<Equipment>
    delete(id: string): Promise<void>
}
