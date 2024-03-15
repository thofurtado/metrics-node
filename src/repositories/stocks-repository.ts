import { Stock, Prisma } from '@prisma/client'

export interface StocksRepository {
    create(data: Prisma.StockUncheckedCreateInput):Promise<Stock> //use itemsRepository.changeStock
    findById(id:string): Promise<Stock | null>
    getItemHistory(item_id:string, start_date?:Date, end_date?: Date):Promise<Stock[] | null>
    // *** can only be deleted if there is no relation with itemTreatments ***
    update(data: Prisma.UserUncheckedUpdateInput):void
    delete(id:string):void
}
