import { TransactionsRepository } from '@/modules/financial/repositories/transactions-repository'



interface GetMonthExpenseAmountUseCaseResponse {
    monthExpenseAmount: number,
    alreadyPaid: number,
    diffFromLastMonth: number
}
export class GetMonthExpenseAmountUseCase {

    constructor(
        private transactionsRepository: TransactionsRepository
    ) { }
    async execute(date?: Date): Promise<GetMonthExpenseAmountUseCaseResponse> {

        const metrics = await this.transactionsRepository.getMonthExpenseAmount(date)


        return metrics
    }
}

