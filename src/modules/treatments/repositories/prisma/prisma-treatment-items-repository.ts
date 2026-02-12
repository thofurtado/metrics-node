import { Prisma } from '@prisma/client'
import { TreatmentItemsRepository } from '@/modules/treatments/repositories/treatmentItems-repository'
import { prisma } from '@/lib/prisma'






export class PrismaTreatmentItemsRepository implements TreatmentItemsRepository {
    async findById(id: string) {
        const treatmentItem = await prisma.treatmentItem.findFirst({ where: { id } })
        return treatmentItem
    }
    async remove(id: string): Promise<void> {
        await prisma.treatmentItem.delete({
            where: { id }
        })
    }
    async findByTreatment(treatment_id: string) {
        const treatmentItems = prisma.treatmentItem.findMany({
            where: {
                treatment_id
            }
        })
        return treatmentItems
    }
    async findByTreatmentAndItemId(treatment_id: string, product_id?: string, service_id?: string, supply_id?: string) {
        const whereClause: any = { treatment_id }

        if (product_id) whereClause.product_id = product_id
        if (service_id) whereClause.service_id = service_id
        if (supply_id) whereClause.supply_id = supply_id

        // Ensure at least one is present to avoid finding unexpected items
        if (!product_id && !service_id && !supply_id) return null

        const treatmentItem = await prisma.treatmentItem.findFirst({
            where: whereClause
        })
        return treatmentItem
    }

    async linkStock(id: string, stock_id: string): Promise<void> {
        await prisma.treatmentItem.update({
            where: { id },
            data: { stock_id }
        })
    }
    async update(data: Prisma.TreatmentItemUncheckedUpdateInput) {
        // Ensure id is a string, though it should be if it comes from data
        if (!data.id) throw new Error("ID required for update")
        const treatmentItem = await prisma.treatmentItem.update({
            where: { id: String(data.id) },
            data,
            include: {
                product: true,
                service: true,
                supply: true
            }
        })
        return treatmentItem
    }
    async delete(id: string): Promise<void> {
        await prisma.treatmentItem.delete({
            where: {
                id
            }
        })
    }

    async create(data: Prisma.TreatmentItemUncheckedCreateInput) {
        const treatmentItem = await prisma.treatmentItem.create({
            data,
            include: {
                product: true,
                service: true,
                supply: true
            }
        })

        return treatmentItem
    }
}
