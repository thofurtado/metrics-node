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
    async findMany(): Promise<Payment[] | null> {
        const payments = await prisma.payment.findMany({
            include: {
                accounts: true
            }
        })
        return payments
    }
    async findByName(name: string): Promise<Payment | null> {
        const payments = await prisma.payment.findFirst({ where: { name } })
        return payments
    }
}