import { prisma } from '@/lib/prisma'
import { Interaction, Prisma } from '@prisma/client'
import { InteractionsRepository } from '../interactions-repository'

export class PrismaInteractionsRepository implements InteractionsRepository {
    async create(data: Prisma.InteractionUncheckedCreateInput): Promise<{ id: string; user_id: string; treatment_id: string; date: Date; description: string }> {
        const interaction = await prisma.interaction.create({
            data
        })
        return interaction
    }
    async update(data: Prisma.InteractionUncheckedUpdateInput): Promise<{ id: string; user_id: string; treatment_id: string; date: Date; description: string }> {
        throw new Error('Method not implemented.')
    }
    async delete(id: string): Promise<void> {
        prisma.interaction.delete({
            where: {
                id
            }
        })
    }
    findByTreatment(treatment_id: string): Promise<Interaction[] | null> {
        const interactions = prisma.interaction.findMany({
            where: {
                treatment_id
            }
        })
        return interactions
    }




}
