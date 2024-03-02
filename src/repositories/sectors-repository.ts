import {Prisma, Sector} from '@prisma/client'

export interface SectorsRepository {
    create(data: Prisma.SectorCreateInput):Promise<Sector>
    findByName(name:string):Promise<Sector | null>
}
