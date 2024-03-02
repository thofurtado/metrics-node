import { TransactionsRepository } from '@/repositories/transactions-repository'
import { Transaction } from '@prisma/client'
import { ResourceNotFoundError } from './errors/resource-not-found-error'
import { AccountsRepository } from '@/repositories/accounts-repository'
import { TransferTransactionsRepository } from '@/repositories/transfer-transactions-repository'

interface TransactionUseCaseRequest {
    operation: string,
    amount: number;
    account_id: string
    date?: Date;
    sector_id?: string;
    description?: string;
    confirmed: boolean;
    destination_account_id?: string;
}

interface TransactionUseCaseResponse {
    transaction: Transaction
}
export class TransactionUseCase {

    constructor(
        private transactionsRepository: TransactionsRepository,
        private transferTransactionsRepository: TransferTransactionsRepository,
        private accountsRepository: AccountsRepository
    ) { }
    async execute({
        operation, amount, account_id, date, sector_id, description, confirmed, destination_account_id
    }: TransactionUseCaseRequest): Promise<TransactionUseCaseResponse> {


        if (operation !== 'income' && operation !== 'expense' && operation !== 'transfer') {
            throw new ResourceNotFoundError()
        }
        if (!account_id) {
            throw new ResourceNotFoundError()
        }
        //as transações de despesa e transferência são deduzidas do balanço da conta de origem,
        //caso contrário(income) são acrescentadas
        const isIncome = operation === 'income' ? true : false
        if (confirmed === true) {

            await this.accountsRepository.changeBalance(account_id, amount, isIncome)
        }

        const transaction = await this.transactionsRepository.create({
            operation, amount, account_id, date, sector_id, description, confirmed
        })

        if (operation === 'transfer' && destination_account_id) {

            await this.transferTransactionsRepository.create({
                destination_account_id: destination_account_id,
                transaction_id: transaction.id
            })
            if (confirmed === true) {
                await this.accountsRepository.changeBalance(destination_account_id, amount, !isIncome)
            }
        }
        return {
            transaction
        }
    }
}


