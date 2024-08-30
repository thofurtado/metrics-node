import { GetTransactionsDTO } from '@/repositories/DTO/get-transactions-dto'
import { TransactionsRepository } from '@/repositories/transactions-repository'
import { Transaction } from '@prisma/client'

interface GetTreatmentsUseCaseRequest {
    pageIndex: number,
    perPage?: number
    description?: string,
    value?:number,
    sector_id?: string
    account_id?: string
    month: Date
}


export class GetTransactionsUseCase {

    constructor(
        private transactionsRepository: TransactionsRepository
    ) { }
    async execute({pageIndex, perPage, description, value, sector_id, account_id, month}:GetTreatmentsUseCaseRequest): Promise<GetTransactionsDTO | null> {
        console.log('USE CASE ACCOUNT'+account_id)
        if(!perPage)
            perPage = 6
        const transactions = await this.transactionsRepository.findMany(month, pageIndex, perPage, description, value, sector_id, account_id)
        return {transactions}

    }
}

