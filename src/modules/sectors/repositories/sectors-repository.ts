import {Prisma, Sector} from '@prisma/client'

export interface SectorsRepository {
    create(data: Prisma.SectorCreateInput):Promise<Sector>
    update(data: Prisma.SectorUpdateInput):Promise<Sector>
    findById(id:string):Promise<Sector | null>
    findByName(name:string):Promise<Sector | null>
    findMany():Promise<Sector[]>
    compareBudget(month?:number, sector_id?:string):Promise<number>
}
