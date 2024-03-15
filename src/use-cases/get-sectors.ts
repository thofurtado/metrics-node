import { SectorsRepository } from '@/repositories/sectors-repository'
import { Sector } from '@prisma/client'



interface GetSectorsUseCaseResponse {
    sectors: Sector[]
}
export class GetSectorsUseCase {

    constructor(
        private sectorsRepository: SectorsRepository
    ) { }
    async execute(): Promise<GetSectorsUseCaseResponse> {

        const sectors = await this.sectorsRepository.findMany()


        return {
            sectors
        }
    }
}

