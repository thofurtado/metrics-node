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
}
