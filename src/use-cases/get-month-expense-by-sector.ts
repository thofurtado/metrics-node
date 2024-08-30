import { TransactionsRepository } from '@/repositories/transactions-repository'



interface GetMonthExpenseBySectorUseCaseResponse {
    sector_name: string,
    amount: number,
}
export class GetMonthExpenseBySectorUseCase {

    constructor(
        private transactionsRepository: TransactionsRepository
    ) { }
    async execute(): Promise<GetMonthExpenseBySectorUseCaseResponse[]> {

        const metrics = await this.transactionsRepository.getMonthExpenseBySector()


        return metrics
    }
}

