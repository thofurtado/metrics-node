import { Payment, Prisma } from '@prisma/client'
import { PaymentsRepository } from '@/modules/financial/repositories/payments-repository'
import { randomUUID } from 'node:crypto'



export class InMemoryPaymentsRepository implements PaymentsRepository {
    public items: Payment[] = []
    async create(data: Prisma.PaymentUncheckedCreateInput): Promise<{ id: string; name: string; installment_limit: number; in_sight: boolean; account_id: string | null }> {
        const payment = {
            id: randomUUID(),
            name: data.name,
            installment_limit: data.installment_limit,
            in_sight: data.in_sight,
            account_id: data.account_id ? data.account_id : null
        }
        this.items.push(payment)
        return payment
    }
    async update(id: string, data: Prisma.PaymentUpdateInput) {
        const index = this.items.findIndex(item => item.id === id)
        const payment = this.items[index]
        const updatedPayment = { ...payment, ...data } as Payment
        this.items[index] = updatedPayment
        return updatedPayment
    }
    async delete(id: string) {
        const index = this.items.findIndex(item => item.id === id)
        if (index >= 0) {
            this.items.splice(index, 1)
        }
    }
    async findById(id: string): Promise<{ id: string; name: string; installment_limit: number; in_sight: boolean; account_id: string | null } | null> {
        const payment = this.items.find((item) => item.id === id)
        return payment || null
    }
    async findByName(name: string): Promise<{ id: string; name: string; installment_limit: number; in_sight: boolean; account_id: string | null } | null> {
        const payment = this.items.find((item) => item.name === name)
        return payment || null
    }
    async findMany(): Promise<Payment[] | null> {
        return this.items
    }
}
