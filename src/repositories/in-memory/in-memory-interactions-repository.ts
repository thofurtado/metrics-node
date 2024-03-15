import { Interaction, Prisma } from '@prisma/client'
import { InteractionsRepository } from '../interactions-repository'
import { randomUUID } from 'node:crypto'




export class InMemoryInteractionsRepository implements InteractionsRepository {
    public items: Interaction[] = []
    async create(data: Prisma.InteractionUncheckedCreateInput) {
        const interaction = {
            id: randomUUID(),
            user_id: data.user_id,
            treatment_id: data.treatment_id,
            date: new Date(data.date) || new Date(),
            description: data.description
        }
        this.items.push(interaction)
        return interaction
    }
    async update(data: Prisma.InteractionUncheckedCreateInput) {
        const index = this.items.findIndex(item => item.id === data.id)
        if (index !== -1) {
            const update = {
                description: data.description ? data.description : this.items[index].description,
                date: data.date ? new Date(data.date) : this.items[index].date
            }
            const interaction = this.items[index] = {
                ...this.items[index],
                ...update
            }
            return interaction
        } else {
            throw new Error(`Interaction with ID ${data.id} not found`)
        }
    }
    async delete(id: string):Promise<void> {
        const index = this.items.findIndex((item) => item.id === id)
        if (index !== -1) {
            this.items.splice(index, 1)
        } else {
            throw new Error(`Interaction with ID ${id} not found`)
        }
    }
    async findByTreatment(treatment_id: string): Promise<{ id: string; user_id: string; treatment_id: string; date: Date; description: string }[] | null> {
        const interactions = this.items.filter((item) => item.treatment_id === treatment_id)
        return interactions.length ? interactions : null
    }

}
