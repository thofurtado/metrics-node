import { Treatment, Prisma } from '@prisma/client'
import { TreatmentsRepository } from '../treatments-repository'
import { randomUUID } from 'node:crypto'


export class InMemoryTreatmentsRepository implements TreatmentsRepository {
    update(data: Prisma.TreatmentUncheckedUpdateInput): Promise<{ id: string; opening_date: Date; ending_date: Date | null; contact: string | null; user_id: string | null; client_id: string | null; equipment_id: string | null; request: string; status: string; amount: number; observations: string | null }> {
        throw new Error('Method not implemented.')
    }
    async findByActive(): Promise<{ id: string; opening_date: Date; ending_date: Date | null; contact: string | null; user_id: string | null; client_id: string | null; equipment_id: string | null; request: string; status: string; amount: number; observations: string | null }[] | null> {
        const activeTreatments = this.items.filter((treatment) => {
            return (
                treatment.status === 'pending' ||
              treatment.status === 'in_progress' ||
              treatment.status === 'on_hold' ||
              treatment.status === 'follow_up'
            )
        })
        return activeTreatments
    }

    public items: Treatment[] = []

    async create(data: Prisma.TreatmentUncheckedCreateInput): Promise<Treatment> {
        const treatment = {
            id: randomUUID(),
            request: data.request,
            opening_date: data.opening_date ? new Date(data.opening_date) : new Date(),
            ending_date: data.ending_date ? new Date(data.ending_date) : null,
            contact: data.contact || null,
            user_id: data.user_id || null,
            client_id: data.client_id || null,
            equipment_id: data.equipment_id || null,
            status: data.status || 'pending',
            amount: data.amount || 0,
            observations: data.observations || null
        }
        this.items.push(treatment)
        return treatment
    }
    async findByClient(client_id: string): Promise<Treatment[] | null> {
        const treatments = this.items.filter((item) => item.client_id === client_id)
        return treatments.length ? treatments : null
    }
    async findByStatus(status: string): Promise<Treatment[] | null> {
        const treatments = this.items.filter((item) => item.status === status)
        return treatments.length ? treatments : null
    }
    async close(id: string): Promise<Treatment | null> {
        const index = this.items.findIndex((item) => item.id === id)
        if (index !== -1) {
            this.items[index].status = 'resolved'
            this.items[index].ending_date = new Date() // Assuming closing sets the ending date
            return this.items[index]
        } else {
            throw new Error(`Treatment with ID ${id} not found`)
        }
    }
    async findById(id: string): Promise<Treatment | null> {
        const treatment = this.items.find(item => item.id === id)
        return treatment ? treatment : null
    }
    async changeValue(id: string, value: number, entry: boolean): Promise<void> {

        // const treatment = await this.findById(id)
        // treatment?.amount = entry ? treatment.amount + value : treatment.amount - value

        // this.items.push(treatment)
    }
}


