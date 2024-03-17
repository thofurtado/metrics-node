import { TreatmentItem, Prisma } from '@prisma/client'

export interface TreatmentItemsRepository {
    create(data: Prisma.TreatmentItemUncheckedCreateInput):Promise<TreatmentItem>
    findByTreatment(treatment_id:string):Promise<TreatmentItem[] | null>
    linkStock(id:string, stock_id:string):Promise<void>
     //only if there is no relation with stock and the treatment is not finished
    update(data: Prisma.TreatmentItemUncheckedUpdateInput):Promise<TreatmentItem>
    remove(id: string):Promise<void>
    findById(id:string): Promise<TreatmentItem | null>
}
