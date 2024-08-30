import { TransactionsRepository } from '@/repositories/transactions-repository'



interface GetMonthIncomeAmountUseCaseResponse {
    monthIncomeAmount: number,
    alreadyPaid: number,
    diffFromLastMonth: number
}
export class GetMonthIncomeAmountUseCase {

    constructor(
        private transactionsRepository: TransactionsRepository
    ) { }
    async execute(): Promise<GetMonthIncomeAmountUseCaseResponse> {

        const metrics = await this.transactionsRepository.getMonthIncomeAmount()


        return metrics

    }
}
