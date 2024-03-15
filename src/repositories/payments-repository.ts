import { Payment, Prisma } from '@prisma/client'

export interface PaymentsRepository {

    //highly recomend to no update payments, this could be some strange think for the history of the financial
    create(data: Prisma.PaymentUncheckedCreateInput):Promise<Payment>
    update(data: Prisma.PaymentUpdateInput):Promise<Payment>
    findById(id:string):Promise<Payment | null>
    findMany():Promise<Payment[] | null>
    findByName(name: string): Promise<Payment | null>
}
