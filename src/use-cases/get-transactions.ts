import { GetTransactionsDTO } from '@/repositories/DTO/get-transactions-dto'
import { TransactionsRepository } from '@/repositories/transactions-repository'
import { Transaction } from '@prisma/client'

interface GetTreatmentsUseCaseRequest {
    pageIndex: number,
    perPage?: number
    description?: string,
    value?: number,
    sector_id?: string
    account_id?: string
    status?: string // Added status
    month: Date
    toDate?: Date // Added toDate
    supplier_id?: string // Added supplier_id
}


export class GetTransactionsUseCase {

    constructor(
        private transactionsRepository: TransactionsRepository
    ) { }
    async execute({ pageIndex, perPage, description, value, sector_id, account_id, month, status, toDate, supplier_id }: GetTreatmentsUseCaseRequest): Promise<GetTransactionsDTO | null> {
        console.log('USE CASE ACCOUNT' + account_id)
        if (!perPage)
            perPage = 6
        const transactions = await this.transactionsRepository.findMany(month, pageIndex, perPage, description, value, sector_id, account_id, status, toDate, supplier_id)
        return transactions

    }
}
