import { TransactionsRepository } from '@/repositories/transactions-repository'



export class GetGeneralBalanceUseCase {

    constructor(
        private transactionsRepository: TransactionsRepository
    ) { }
    async execute(): Promise<number> {

        const metrics = await this.transactionsRepository.getBalance()

        return metrics
    }
}

