
import { PrismaSectorsRepository } from '@/repositories/prisma/prisma-sectors-repository'
import { GetSectorsUseCase } from '../get-sectors'

export function MakeGetSectorsUseCase() {
    const sectorsRepository = new PrismaSectorsRepository()
    const getSectorUseCase = new GetSectorsUseCase(sectorsRepository)
    return getSectorUseCase
}
