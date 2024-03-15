import { Prisma } from '@prisma/client'
import { TreatmentItemsRepository } from '../treatmentItems-repository'
import { prisma } from '@/lib/prisma'






export class PrismaTreatmentItemsRepository implements TreatmentItemsRepository {
    async findByTreatment(treatment_id: string): Promise<{ id: string; item_id: string; treatment_id: string; stock_id: string | null; quantity: number; salesValue: number | null }[] | null> {
        const treatmentItems = prisma.treatmentItem.findMany({
            where: {
                treatment_id
            }
        })
        return treatmentItems
    }
    async linkStock(id: string, stock_id: string): Promise<void> {
        await prisma.treatmentItem.update({
            where: { id },
            data: { stock_id }
        })
    }
    update(data: Prisma.TreatmentItemUncheckedUpdateInput): Promise<{ id: string; item_id: string; treatment_id: string; stock_id: string | null; quantity: number; salesValue: number | null }> {
        throw new Error('Method not implemented.')
    }
    async delete(id: string): Promise<void> {
        await prisma.treatmentItem.delete({
            where: {
                id
            }
        })
    }

    async create(data: Prisma.TreatmentItemUncheckedCreateInput) {
        const treatmentItem = prisma.treatmentItem.create({
            data
        })

        return treatmentItem
    }
}
