import { prisma } from '@/lib/prisma'
import { Treatment, Prisma } from '@prisma/client'
import { TreatmentsRepository } from '../treatments-repository'

export class PrismaTreatmentsRepository implements TreatmentsRepository {
    async changeValue(id: string, value: number, entry: boolean): Promise<void> {
        if(entry) {
            await prisma.treatment.update({
                where: { id },
                data: {
                    amount: {increment: value}
                }
            })
        } else {
            await prisma.treatment.update({
                where: { id },
                data: {
                    amount: {decrement: value}
                }
            })
        }

    }
    async create(data: Prisma.TreatmentUncheckedCreateInput): Promise<Treatment> {
        const treatment = await prisma.treatment.create({
            data
        })
        return treatment
    }
    async findById(id: string): Promise<Treatment | null> {
        const treatment = await prisma.treatment.findFirst({
            where: {
                id
            }
        })

        return treatment
    }
    update(data: Prisma.TreatmentUncheckedUpdateInput): Promise<{ id: string; opening_date: Date; ending_date: Date | null; contact: string | null; user_id: string | null; client_id: string | null; equipment_id: string | null; request: string; finished: boolean; amount: number; observations: string | null }> {
        throw new Error('Method not implemented.')
    }
    async findByClient(client_id: string): Promise<{ id: string; opening_date: Date; ending_date: Date | null; contact: string | null; user_id: string | null; client_id: string | null; equipment_id: string | null; request: string; finished: boolean; amount: number; observations: string | null }[] | null> {
        const treatments = await prisma.treatment.findMany({
            where: {
                client_id
            }
        })
        return treatments
    }
    async findByStatus(status: boolean): Promise<{ id: string; opening_date: Date; ending_date: Date | null; contact: string | null; user_id: string | null; client_id: string | null; equipment_id: string | null; request: string; finished: boolean; amount: number; observations: string | null }[] | null> {
        const treatments = prisma.treatment.findMany({
            where: {
                finished: status
            },
            include: {
                users: true,
                equipments:true,
                items: true
            }
        })

        return treatments
    }
    async close(id: string): Promise<Treatment | null> {
        const treatment = await prisma.treatment.update({
            where: { id },
            data: {
                ending_date: new Date(),
                finished: true
            }
        })
        return treatment
    }

}
