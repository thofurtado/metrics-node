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
}
