import { prisma } from '@/lib/prisma'
import { Payment, Prisma } from '@prisma/client'
import { PaymentsRepository } from '../payments-repository'
import { PaymentDoc, PaymentFindRequest, PaymentFindResponse } from './prisma-interfaces.interfaces'

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
    async findMany(data?: PaymentFindRequest): Promise<PaymentFindResponse> {
        const { from = null, to = null, page = 1, quantity: take = 10 } = data ?? {}
        let skip: number = 0;
        if (page > 1) {
            skip = (page * take) - take
        }
        let filter: { where?: { createdAt?: any }, orderBy?: any } = {}
        if (from) {
            filter.where = {
                createdAt: to ?
                    {
                        gte: new Date(from),
                        lte: new Date(to)
                    } :
                    {
                        gte: new Date(from)
                    }
            }
        } else {
            if (to) {
                filter.where = { createdAt: { lte: new Date(to) } }
            }
        }
        filter.orderBy = {
            //createdAt: { sort: 'desc' } => caso queira ver os mais recentes primeiro
            createdAt: { sort: 'asc' }
        }
        const total = filter.where ?
            prisma.payment.count({ where: filter.where }) :
            prisma.payment.count()
        const payments = await prisma.payment.findMany({ ...filter, skip, take }).catch((error: any) => {
            console.log(JSON.stringify(error))
            return []
        }) as PaymentDoc[]
        return { docs: payments, total, page, pages: total ? Math.ceil(total / take) : 1 }
    }
    async findByName(name: string): Promise<{ id: string; name: string; installment_limit: number; in_sight: boolean; account_id: string | null } | null> {
        const payments = await prisma.payment.findFirst({ where: { name } })
        return payments
    }

}
