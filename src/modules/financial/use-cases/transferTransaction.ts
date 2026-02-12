import { TransferTransactionsRepository } from '@/modules/financial/repositories/transfer-transactions-repository'
import { TransferTransaction } from '@prisma/client'
import { ResourceNotFoundError } from '@/errors/resource-not-found-error'
import { TransactionsRepository } from '@/modules/financial/repositories/transactions-repository'
import { AccountsRepository } from '@/modules/financial/repositories/accounts-repository'

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

        const destinationAccount = await this.accountsRepository.findById(destination_account_id)
        if (!destinationAccount) {
            throw new ResourceNotFoundError()
        }

        const originTransaction = await this.transactionsRepository.findById(transaction_id)
        if (!originTransaction) {
            throw new ResourceNotFoundError()
        }

        if (originTransaction.account_id === destination_account_id) {
            throw new Error('Cannot transfer to the same account.')
        }

        const originAccount = await this.accountsRepository.findById(originTransaction.account_id)
        if (!originAccount) {
            throw new ResourceNotFoundError()
        }

        const transferTransactions = await this.transferTransactionssRepository.executeTransfer({
            originTransactionId: transaction_id,
            destinationAccountId: destination_account_id,
            amount: originTransaction.amount,
            originAccountName: originAccount.name
        })

        return {
            transferTransactions
        }
    }
}

