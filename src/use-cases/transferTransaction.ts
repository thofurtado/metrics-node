import { TransferTransactionsRepository } from '@/repositories/transfer-transactions-repository'
import { TransferTransaction } from '@prisma/client'
import { ResourceNotFoundError } from './errors/resource-not-found-error'
import { TransactionsRepository } from '@/repositories/transactions-repository'
import { AccountsRepository } from '@/repositories/accounts-repository'

interface TransferTransactionUseCaseRequest {
    destination_account_id: string,
    transaction_id: string
}
interface TransferTransactionUseCaseResponse {
    transferTransactions: TransferTransaction
}
export class TransferTransactionUseCase {

    constructor(
        private transferTransactionssRepository: TransferTransactionsRepository,
        private transactionsRepository: TransactionsRepository,
        private accountsRepository: AccountsRepository
    ) { }
    async execute({
        destination_account_id, transaction_id
    }: TransferTransactionUseCaseRequest): Promise<TransferTransactionUseCaseResponse> {
        let account
        if (destination_account_id) {
            account = await this.accountsRepository.findById(destination_account_id)
            if (!account)
                throw new ResourceNotFoundError()
        }
        let transaction
        if (transaction_id) {
            transaction = await this.transactionsRepository.findById(transaction_id)
            if (!transaction)
                throw new ResourceNotFoundError()
        }

        const transferTransactions = await this.transferTransactionssRepository.create({
            transaction_id,
            destination_account_id
        })
        return {
            transferTransactions
        }
    }
}

