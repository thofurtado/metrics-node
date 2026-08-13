import { GetTransactionsDTO } from '@/modules/financial/repositories/DTO/get-transactions-dto'
import { TransactionsRepository } from '@/modules/financial/repositories/transactions-repository'
import { Transaction } from '@prisma/client'

interface GetTreatmentsUseCaseRequest {
    pageIndex: number,
    perPage?: number
    description?: string,
    value?: number,
    sector_id?: string
    account_id?: string | string[]
    status?: string // Added status
    month?: Date
    toDate?: Date // Added toDate
    fromDate?: Date // Added fromDate
    supplier_id?: string // Added supplier_id
    type?: string // Added type
    sortBy?: string
    sortDirection?: string
    checked?: string
}


export class GetTransactionsUseCase {

    constructor(
        private transactionsRepository: TransactionsRepository
    ) { }
    async execute({ pageIndex, perPage, description, value, sector_id, account_id, month, status, toDate, fromDate, supplier_id, type, sortBy, sortDirection, checked }: GetTreatmentsUseCaseRequest): Promise<GetTransactionsDTO | null> {
        console.log('USE CASE ACCOUNT' + account_id)
        if (!perPage)
            perPage = 6

        let operation
        if (type === 'in') {
            operation = 'income'
        } else if (type === 'out') {
            operation = 'expense'
        }

        const transactions = await this.transactionsRepository.findMany(month, pageIndex, perPage, description, value, sector_id, account_id, status, toDate, supplier_id, operation, fromDate, sortBy, sortDirection, checked)
        return transactions

    }
}
