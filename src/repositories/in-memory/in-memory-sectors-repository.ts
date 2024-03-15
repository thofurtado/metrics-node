import { Sector, Prisma } from '@prisma/client'
import { SectorsRepository } from '../sectors-repository'
import { randomUUID } from 'node:crypto'



export class InMemorySectorsRepository implements SectorsRepository {
    public items: Sector[] = []

    async findByName(name: string) {
        const sector = this.items.find(item => item.name === name)

        if (!sector) {
            return null
        }
        return sector
    }

    async create(data: Prisma.SectorCreateInput) {
        const sector = {
            id: randomUUID(),
            name: data.name,
            budget: data.budget ?? null,
        }
        this.items.push(sector)
        return sector
    }
    async update(data: Prisma.SectorUpdateInput): Promise<{ id: string; name: string; budget: number | null }> {
        throw new Error('Method not implemented.')
    }
    async findById(id: string): Promise<Sector | null> {
        const sector = this.items.find(item => item.id === id)
        return sector || null
    }
    async findMany(): Promise<Sector[]> {
        const sectors = this.items

        return sectors
    }
    async compareBudget(month?: number | undefined, sector_id?: string | undefined): Promise<number> {
        throw new Error('Method not implemented.')
    }

}
