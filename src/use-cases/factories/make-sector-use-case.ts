import { SectorUseCase } from '../sector'
import { PrismaSectorsRepository } from '@/repositories/prisma/prisma-sectors-repository'

export function MakeSectorUseCase() {
    const sectorsRepository = new PrismaSectorsRepository()
    const sectorUseCase = new SectorUseCase(sectorsRepository)
    return sectorUseCase
}
