import { TransactionsRepository } from '@/modules/financial/repositories/transactions-repository'



interface GetMonthIncomeByDaysUseCaseResponse {
    day: string,
    revenue: number,
}
export class GetMonthIncomeByDaysUseCase {

    constructor(
        private transactionsRepository: TransactionsRepository
    ) { }
    async execute(date?: Date): Promise<GetMonthIncomeByDaysUseCaseResponse[]> {

        const metrics = await this.transactionsRepository.getMonthIncomeByDays(date)

        return metrics
    }
}
