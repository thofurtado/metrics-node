import { TransactionsRepository } from '@/modules/financial/repositories/transactions-repository'
import { Transaction } from '@prisma/client'
import { ResourceNotFoundError } from '@/errors/resource-not-found-error'
import { AccountsRepository } from '@/modules/financial/repositories/accounts-repository'
import { TransferTransactionsRepository } from '@/modules/financial/repositories/transfer-transactions-repository'
import { prisma } from '@/lib/prisma'

interface TransactionUseCaseRequest {
    operation: string,
    amount: number;
    account_id: string
    date?: Date | null;
    sector_id?: string | null;
    description?: string | null;
    confirmed: boolean | null;
    destination_account_id?: string | null;
    supplier_id?: string | null;
    installments_count?: number;
    interval_frequency?: 'WEEKLY' | 'MONTHLY' | 'YEARLY';
    custom_installments?: { date: Date, amount: number }[];
    interest?: number | null;
    discount?: number | null;
    totalValue?: number | null;
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
        operation, amount, account_id, date, sector_id, description, confirmed, destination_account_id, supplier_id, installments_count, interval_frequency, custom_installments, interest, discount, totalValue
    }: TransactionUseCaseRequest): Promise<TransactionUseCaseResponse> {

        // Test for the right operation
        if (operation !== 'income' && operation !== 'expense' && operation !== 'transfer') {
            throw new ResourceNotFoundError()
        }

        // verify if the account exists
        let account
        if (account_id)
            account = await this.accountsRepository.findById(account_id)
        if (!account)
            throw new ResourceNotFoundError()

        //as transações de despesa e transferência são deduzidas do balanço da conta de origem,
        //caso contrário(income) são acrescentadas
        const isIncome = operation === 'income' ? true : false

        // 1. Prepare Installments Plan
        let installmentsPlan: { date: Date, amount: number, number: number }[] = []

        const baseDescription = description || '';
        const transactionDate = date ? date : new Date();

        const totalInstallments = installments_count && installments_count > 1 ? installments_count : 1;

        if (totalInstallments > 1) {
            if (!custom_installments || custom_installments.length === 0) {
                throw new Error("Missing custom installments data for installment transaction.");
            }
            // Use Custom Plan
            installmentsPlan = custom_installments.map((inst, index) => ({
                date: new Date(inst.date),
                amount: inst.amount,
                number: index + 1
            }))
        } else {
            // Single Transaction
            installmentsPlan.push({ date: transactionDate, amount, number: 1 })
        }

        // EXECUTE ATOMIC TRANSACTION
        return await prisma.$transaction(async (tx) => {
            let firstTransaction: Transaction | null = null;

            if (installmentsPlan.length > 1) {
                // NESTED WRITE: Create Group AND Transactions in one go
                const group = await tx.transactionGroup.create({
                    data: {
                        totalAmount: amount,
                        installmentsCount: installmentsPlan.length,
                        description: description,
                        frequency: interval_frequency || null,
                        transactions: {
                            create: installmentsPlan.map((item) => {
                                const isFirst = item.number === 1;
                                const currentDescription = `${baseDescription} (${item.number}/${installmentsPlan.length})`;
                                // Only the first one is confirmed if requested
                                const isConfirmed = isFirst ? (operation === 'transfer' ? true : confirmed ? confirmed : false) : false;

                                return {
                                    operation,
                                    amount: item.amount,
                                    account_id,
                                    date: item.date,
                                    sector_id,
                                    description: currentDescription,
                                    confirmed: isConfirmed,
                                    supplier_id: supplier_id,
                                    interest: isFirst ? interest : 0,
                                    discount: isFirst ? discount : 0,
                                    totalValue: isFirst ? totalValue : item.amount,
                                    // parent_transaction_id: we rely on transaction_group_id relation
                                }
                            })
                        }
                    },
                    include: {
                        transactions: true
                    }
                })

                // Find the first transaction to handle side effects (balance, transfer)
                // We assume the one with number=1 based on description logic or sorting, 
                // but relying on the array order or finding the one with confirmed=true/earliest date is safer if we didn't store 'number'.
                // Since we just created them, we can try to find the one matching the first installment plan date/amount/desc.
                const firstDescription = `${baseDescription} (1/${installmentsPlan.length})`;
                firstTransaction = group.transactions.find((t: Transaction) => t.description === firstDescription) || group.transactions[0];

            } else {
                // SINGLE TRANSACTION
                const item = installmentsPlan[0];
                const isConfirmed = operation === 'transfer' ? true : confirmed ? confirmed : false;

                firstTransaction = await tx.transaction.create({
                    data: {
                        operation,
                        amount: item.amount,
                        account_id,
                        date: item.date,
                        sector_id,
                        description: baseDescription,
                        confirmed: isConfirmed,
                        supplier_id: supplier_id,
                        interest,
                        discount,
                        totalValue,
                    }
                })
            }

            if (!firstTransaction) throw new Error("Failed to create transaction");

            // SIDE EFFECTS (Balance & Transfer) - Applied to the First Transaction
            // If the first transaction is confirmed, update the balance.
            if (firstTransaction.confirmed) {
                await this.accountsRepository.changeBalance(account_id, firstTransaction.amount, isIncome, tx)
            }

            // Handle Transfer (Only single/first support usually, but logic kept generalized)
            if (operation === 'transfer' && destination_account_id) {
                await this.transferTransactionsRepository.create({
                    destination_account_id: destination_account_id,
                    transaction_id: firstTransaction.id
                }, tx)
                await this.accountsRepository.changeBalance(destination_account_id, firstTransaction.amount, !isIncome, tx)
            }

            return {
                transaction: firstTransaction
            }
        })
    }
}


