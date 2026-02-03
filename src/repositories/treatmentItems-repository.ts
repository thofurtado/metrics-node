import { TreatmentItem, Prisma, Product, Service, Supply } from '@prisma/client'

export interface TreatmentItemsRepository {
    create(data: Prisma.TreatmentItemUncheckedCreateInput): Promise<TreatmentItem & { product: Product | null; service: Service | null; supply: Supply | null }>
    findByTreatment(treatment_id: string): Promise<TreatmentItem[] | null>
    findByTreatmentAndItemId(treatment_id: string, product_id?: string, service_id?: string, supply_id?: string): Promise<TreatmentItem | null>
    linkStock(id: string, stock_id: string): Promise<void>
    //only if there is no relation with stock and the treatment is not finished
    update(data: Prisma.TreatmentItemUncheckedUpdateInput): Promise<TreatmentItem & { product: Product | null; service: Service | null; supply: Supply | null }>
    remove(id: string): Promise<void>
    findById(id: string): Promise<TreatmentItem | null>
}
