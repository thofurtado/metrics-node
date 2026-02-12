import { SectorUseCase } from '@/modules/sectors/use-cases/sector'
import { PrismaSectorsRepository } from '@/modules/sectors/repositories/prisma/prisma-sectors-repository'

export function MakeSectorUseCase() {
    const sectorsRepository = new PrismaSectorsRepository()
    const sectorUseCase = new SectorUseCase(sectorsRepository)
    return sectorUseCase
}
