import { Treatment, Prisma } from '@prisma/client'

export interface TreatmentsRepository {
    create(data: Prisma.TreatmentUncheckedCreateInput):Promise<Treatment>
    update(data: Prisma.TreatmentUncheckedUpdateInput):Promise<Treatment>
    findByClient(client_id:string):Promise<Treatment[] | null>
    findByStatus(status:boolean):Promise<Treatment[] | null>
    findById(id:string):Promise<Treatment | null>
    close(id:string):Promise<Treatment | null>
    changeValue(id:string, value: number, entry:boolean):Promise<void>
}

