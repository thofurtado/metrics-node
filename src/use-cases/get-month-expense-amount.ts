import { TransactionsRepository } from '@/repositories/transactions-repository'



interface GetMonthExpenseAmountUseCaseResponse {
    monthExpenseAmount: number,
    alreadyPaid: number,
    diffFromLastMonth: number
}
export class GetMonthExpenseAmountUseCase {

    constructor(
        private transactionsRepository: TransactionsRepository
    ) { }
    async execute(): Promise<GetMonthExpenseAmountUseCaseResponse> {

        const metrics = await this.transactionsRepository.getMonthExpenseAmount()


        return metrics
    }
}

