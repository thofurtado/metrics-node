import { PaymentEntry, Prisma } from '@prisma/client'

export interface PaymentEntrysRepository {

    //highly recomend to no update payments, this could be some strange thing to do for the history of the financial
    create(data: Prisma.PaymentEntryUncheckedCreateInput):Promise<PaymentEntry>
    update(data: Prisma.PaymentEntryUncheckedUpdateInput):Promise<PaymentEntry>
    findById(id:string):Promise<PaymentEntry | null>
    findMany():Promise<PaymentEntry[] | null>
}
