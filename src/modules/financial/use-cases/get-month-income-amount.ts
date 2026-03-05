import { TransactionsRepository } from '@/modules/financial/repositories/transactions-repository'



interface GetMonthIncomeAmountUseCaseResponse {
    monthIncomeAmount: number,
    alreadyPaid: number,
    diffFromLastMonth: number
}
export class GetMonthIncomeAmountUseCase {

    constructor(
        private transactionsRepository: TransactionsRepository
    ) { }
    async execute(date?: Date): Promise<GetMonthIncomeAmountUseCaseResponse> {

        const metrics = await this.transactionsRepository.getMonthIncomeAmount(date)


        return metrics

    }
}
