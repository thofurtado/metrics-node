import { Prisma } from '@prisma/client'
import { SectorsRepository } from '../sectors-repository'

import { prisma } from '@/lib/prisma'



export class PrismaSectorsRepository implements SectorsRepository {

    async findByName(name: string) {
        const sector = prisma.sector.findFirst({
            where: {
                name
            }
        })

        if (!sector) {
            return null
        }
        return sector
    }

    async create(data: Prisma.SectorCreateInput) {
        const sector = prisma.sector.create({
            data
        })
        return sector
    }
    update(data: Prisma.SectorUpdateInput): Promise<{ id: string; name: string; budget: number | null }> {
        throw new Error('Method not implemented.')
    }
    findById(id: string): Promise<{ id: string; name: string; budget: number | null } | null> {
        const sector = prisma.sector.findFirst({
            where: { id }
        })
        return sector
    }
    async findMany(): Promise<{ id: string; name: string; budget: number | null }[]> {
        const sectors = await prisma.sector.findMany({
            orderBy: [
                {
                    name: 'asc'
                }
            ],

        })
        return sectors
    }
    compareBudget(month?: number | undefined, sector_id?: string | undefined): Promise<number> {
        throw new Error('Method not implemented.')
    }
}
