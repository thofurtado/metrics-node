import { PaymentEntry, Prisma } from '@prisma/client'
import { PaymentEntrysRepository } from '../paymentEntrys-repository'
import { randomUUID } from 'node:crypto'




export class InMemoryPaymentEntrysRepository implements PaymentEntrysRepository {

    public items: PaymentEntry[] = []
    async create(data: Prisma.PaymentEntryUncheckedCreateInput) {
        const paymentEntry = {
            id: randomUUID(),
            payment_id: data.payment_id,
            treatment_id:data.treatment_id,
            occurrences: data.occurrences,
            amount: data.amount
        }
        this.items.push(paymentEntry)
        return paymentEntry
    }
    update(data: Prisma.PaymentEntryUncheckedUpdateInput): Promise<{ id: string; payment_id: string; treatment_id: string; occurrences: number; amount: number }> {
        throw new Error('Method not implemented.')
    }
    async findById(id: string) {
        const paymentEntry = this.items.find((item) => item.id === id)
        return paymentEntry || null
    }

    async findMany():Promise<PaymentEntry[] | null>{
        const paymentEntrys = this.items.slice()
        return paymentEntrys || null
    }
}
