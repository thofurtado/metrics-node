
import { PrismaSectorsRepository } from '@/modules/sectors/repositories/prisma/prisma-sectors-repository'
import { GetSectorsUseCase } from '@/modules/sectors/use-cases/get-sectors'

export function MakeGetSectorsUseCase() {
    const sectorsRepository = new PrismaSectorsRepository()
    const getSectorUseCase = new GetSectorsUseCase(sectorsRepository)
    return getSectorUseCase
}
