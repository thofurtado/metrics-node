import { Treatment, Prisma } from '@prisma/client'
import { GetTreatmentDTO } from './DTO/get-treatments-dto'


export interface TreatmentsRepository {
    create(data: Prisma.TreatmentUncheckedCreateInput): Promise<Treatment>
    update(id:string, data: Prisma.TreatmentUncheckedUpdateInput): Promise<Treatment>
    findByClient(client_id: string): Promise<Treatment[] | null>
    findByStatus(status: string): Promise<Treatment[] | null>
    findByActive( pageIndex?: number, perPage?: number, treatmentId?: string, clientName?: string, status?:string): Promise<GetTreatmentDTO | null >
    findById(id: string): Promise<Treatment | null>
    close(id: string): Promise<Treatment | null>
    changeValue(id: string, value: number, entry: boolean): Promise<void>
    getMonthTreatmentsAmount(): Promise<{amount: number, diffFromLastMonth: number}>
}

