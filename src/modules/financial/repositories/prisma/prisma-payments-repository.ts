import { prisma } from '@/lib/prisma'
import { Payment, Prisma } from '@prisma/client'
import { PaymentsRepository } from '@/modules/financial/repositories/payments-repository'

export class PrismaPaymentsRepository implements PaymentsRepository {
    async create(data: Prisma.PaymentUncheckedCreateInput): Promise<Payment> {
        const payment = await prisma.payment.create({
            data
        })
        return payment
    }
    async update(id: string, data: Prisma.PaymentUncheckedUpdateInput): Promise<Payment> {
        const payment = await prisma.payment.update({
            where: { id },
            data
        })
        return payment
    }
    async delete(id: string): Promise<void> {
        await prisma.payment.delete({
            where: { id }
        })
    }
    async findById(id: string): Promise<Payment | null> {
        const payment = await prisma.payment.findFirst({
            where: {
                id
            }
        })
        return payment
    }
    async findMany(): Promise<any[] | null> {
        const payments = await prisma.payment.findMany({
            select: {
                id: true,
                name: true,
                installment_limit: true,
                in_sight: true,
                account_id: true,
                active: true,
                active_for_in: true,
                active_for_out: true,
                created_at: true,
                updated_at: true,
                accounts: true,
            }
        })
        return payments.map((p: any) => ({
            ...p,
            show_in_menu: p.active_for_out !== false,
        }))
    }
    async findByName(name: string): Promise<Payment | null> {
        const payments = await prisma.payment.findFirst({ where: { name } })
        return payments
    }
}