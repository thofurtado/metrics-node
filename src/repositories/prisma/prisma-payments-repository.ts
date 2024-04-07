import { prisma } from '@/lib/prisma'
import { Payment, Prisma } from '@prisma/client'
import { PaymentsRepository } from '../payments-repository'

export class PrismaPaymentsRepository implements PaymentsRepository {
    async create(data: Prisma.PaymentUncheckedCreateInput): Promise<Payment> {
        const payment = await prisma.payment.create({
            data
        })
        return payment
    }
    update(data: Prisma.PaymentUpdateInput): Promise<{ id: string; name: string; installment_limit: number; in_sight: boolean; account_id: string | null }> {
        throw new Error('Method not implemented.')
    }
    async findById(id: string): Promise<{ id: string; name: string; installment_limit: number; in_sight: boolean; account_id: string | null } | null> {
        const payment = await prisma.payment.findFirst({
            where: {
                id
            }
        })
        return payment
    }
    async findMany(data?: { page?: number, quantity?: number }): Promise<{ id: string; name: string; installment_limit: number; in_sight: boolean; account_id: string | null }[] | null> {
        const { page = 1, quantity: take = 10 } = data ?? {}
        let skip: number = 0;
        if(page > 1){
            skip = (page * take) - take
        }
        const payments = await prisma.payment.findMany({ skip, take }).catch((error: any) =>{
            console.log(JSON.stringify(error))
            return []
        })

        return payments
    }
    async findByName(name: string): Promise<{ id: string; name: string; installment_limit: number; in_sight: boolean; account_id: string | null } | null> {
        const payments = await prisma.payment.findFirst({ where: { name } })
        return payments
    }

}
