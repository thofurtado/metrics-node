import { prisma } from '@/lib/prisma'
import { PaymentEntry, Prisma } from '@prisma/client'
import { PaymentEntrysRepository } from '../paymentEntrys-repository'

export class PrismaPaymentEntrysRepository implements PaymentEntrysRepository {
    update(data: Prisma.PaymentEntryUncheckedUpdateInput): Promise<{ id: string; payment_id: string; treatment_id: string; occurrences: number; amount: number }> {
        throw new Error('Method not implemented.')
    }
    async findById(id: string): Promise<{ id: string; payment_id: string; treatment_id: string; occurrences: number; amount: number } | null> {
        const paymentEntry = prisma.paymentEntry.findMany({ where: { id } })
        return paymentEntry
    }
    async findMany(): Promise<{ id: string; payment_id: string; treatment_id: string; occurrences: number; amount: number }[] | null> {
        const paymentEntry = prisma.paymentEntry.findMany()
        return paymentEntry
    }
    async create(data: Prisma.PaymentEntryUncheckedCreateInput): Promise<PaymentEntry> {
        const paymentEntry = await prisma.paymentEntry.create({
            data
        })
        return paymentEntry
    }

}
