import { StocksRepository } from '@/repositories/stocks-repository'
import { Stock } from '@prisma/client'


interface GetStockByItemUseCaseRequest {
    item_id: string
}

interface GetStocksUseCaseResponse {
    stocks: Stock[] | null
}
export class GetStocksByItemUseCase {

    constructor(
        private stocksRepository: StocksRepository
    ) { }
    async execute({ item_id }: GetStockByItemUseCaseRequest): Promise<GetStocksUseCaseResponse> {

        const stocks = await this.stocksRepository.getItemHistory(item_id)


        return {
            stocks
        }
    }
}

