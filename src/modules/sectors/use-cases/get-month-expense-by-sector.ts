import { TransactionsRepository } from '@/modules/financial/repositories/transactions-repository'



interface GetMonthExpenseBySectorUseCaseResponse {
    sector_name: string,
    amount: number,
}
export class GetMonthExpenseBySectorUseCase {

    constructor(
        private transactionsRepository: TransactionsRepository
    ) { }
    async execute(date?: Date): Promise<GetMonthExpenseBySectorUseCaseResponse[]> {

        const metrics = await this.transactionsRepository.getMonthExpenseBySector(date)


        return metrics
    }
}

