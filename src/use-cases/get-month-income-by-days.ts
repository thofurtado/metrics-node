import { TransactionsRepository } from '@/repositories/transactions-repository'



interface GetMonthIncomeByDaysUseCaseResponse {
    day: string,
    revenue: number,
}
export class GetMonthIncomeByDaysUseCase {

    constructor(
        private transactionsRepository: TransactionsRepository
    ) { }
    async execute(): Promise<GetMonthIncomeByDaysUseCaseResponse[]> {

        const metrics = await this.transactionsRepository.getMonthIncomeByDays()

        return metrics
    }
}
