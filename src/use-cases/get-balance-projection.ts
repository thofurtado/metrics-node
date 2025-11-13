// use-cases/get-balance-projection.ts
import { BalanceProjectionRepository } from '@/repositories/balance-projection-repository'

interface GetBalanceProjectionUseCaseRequest {
    days?: number
}

interface GetBalanceProjectionUseCaseResponse {
    projection: {
        currentBalance: number
        dailyBalances: {
            date: string
            balance: number
            isProjection: boolean
        }[]
    }
}

export class GetBalanceProjectionUseCase {
    constructor(
        private balanceProjectionRepository: BalanceProjectionRepository
    ) { }

    async execute({ days = 30 }: GetBalanceProjectionUseCaseRequest = {}): Promise<GetBalanceProjectionUseCaseResponse> {
        const projection = await this.balanceProjectionRepository.getBalanceProjection(days)

        return { projection }
    }
}