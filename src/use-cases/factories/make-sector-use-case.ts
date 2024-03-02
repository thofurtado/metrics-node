import { SectorUseCase } from '../sectors'
import { PrismaSectorsRepository } from '@/repositories/prisma/prisma-sectors-repository'

export function makeSectorUseCase() {
    const sectorsRepository = new PrismaSectorsRepository()
    const sectorUseCase = new SectorUseCase(sectorsRepository)
    return sectorUseCase
}
