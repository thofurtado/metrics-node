import { TransactionsRepository } from '@/modules/financial/repositories/transactions-repository'
import { Transaction } from '@prisma/client'
import { ResourceNotFoundError } from '@/errors/resource-not-found-error'
import { AccountsRepository } from '@/modules/financial/repositories/accounts-repository'
import { TransferTransactionsRepository } from '@/modules/financial/repositories/transfer-transactions-repository'
import { prisma } from '@/lib/prisma'

interface TransactionUseCaseRequest {
    operation: string,
    amount: number;
    account_id?: string | null;
    data_vencimento?: Date | null;
    data_emissao?: Date | null;
    sector_id?: string | null;
    description?: string | null;
    confirmed: boolean | null;
    destination_account_id?: string | null;
    supplier_id?: string | null;
    payment_method?: string | null;
    installments_count?: number;
    interval_frequency?: 'WEEKLY' | 'MONTHLY' | 'YEARLY';
    custom_installments?: { data_vencimento: Date, data_emissao?: Date, amount: number }[];
    interest?: number | null;
    discount?: number | null;
    totalValue?: number | null;
    credit_card_id?: string | null;
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
        operation, amount, account_id, data_vencimento, data_emissao, sector_id, description, confirmed, destination_account_id, supplier_id, payment_method, installments_count, interval_frequency, custom_installments, interest, discount, totalValue, credit_card_id
    }: TransactionUseCaseRequest): Promise<TransactionUseCaseResponse> {

        // Test for the right operation
        if (operation !== 'income' && operation !== 'expense' && operation !== 'transfer') {
            throw new ResourceNotFoundError()
        }

        // verify if the account exists
        if (account_id) {
            const account = await this.accountsRepository.findById(account_id)
            if (!account)
                throw new ResourceNotFoundError()
        }

        //as transações de despesa e transferência são deduzidas do balanço da conta de origem,
        //caso contrário(income) são acrescentadas
        const isIncome = operation === 'income' ? true : false

        // 1. Prepare Installments Plan
        let installmentsPlan: { data_vencimento: Date, data_emissao: Date, amount: number, number: number }[] = []

        const baseDescription = description || '';
        const transactionVencimento = data_vencimento ? data_vencimento : new Date();
        const transactionEmissao = data_emissao ? data_emissao : new Date();

        const totalInstallments = installments_count && installments_count > 1 ? installments_count : 1;

        if (totalInstallments > 1) {
            if (!custom_installments || custom_installments.length === 0) {
                throw new Error("Missing custom installments data for installment transaction.");
            }
            // Use Custom Plan
            installmentsPlan = custom_installments.map((inst, index) => ({
                data_vencimento: new Date(inst.data_vencimento),
                data_emissao: inst.data_emissao ? new Date(inst.data_emissao) : transactionEmissao,
                amount: inst.amount,
                number: index + 1
            }))
        } else {
            // Single Transaction
            installmentsPlan.push({ data_vencimento: transactionVencimento, data_emissao: transactionEmissao, amount, number: 1 })
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
                                    account_id: account_id || null,
                                    data_vencimento: item.data_vencimento,
                                    data_emissao: item.data_emissao,
                                    sector_id: sector_id || null,
                                    description: currentDescription,
                                    confirmed: isConfirmed,
                                    supplier_id: supplier_id || null,
                                    payment_method: payment_method || "BOLETO",
                                    interest: isFirst ? interest : 0,
                                    discount: isFirst ? discount : 0,
                                    totalValue: isFirst && totalValue !== null ? totalValue : (isConfirmed ? item.amount : null),
                                    credit_card_id: credit_card_id || null,
                                    // parent_transaction_id: we rely on transaction_group_id relation
                                } as any
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
                firstTransaction = (group as any).transactions.find((t: Transaction) => t.description === firstDescription) || (group as any).transactions[0];

            } else {
                // SINGLE TRANSACTION
                const item = installmentsPlan[0];
                const isConfirmed = operation === 'transfer' ? true : confirmed ? confirmed : false;

                firstTransaction = await tx.transaction.create({
                    data: {
                        operation,
                        amount: item.amount,
                        account_id: account_id || null,
                        data_vencimento: item.data_vencimento,
                        data_emissao: item.data_emissao,
                        sector_id: sector_id || null,
                        description: baseDescription,
                        confirmed: isConfirmed,
                        supplier_id: supplier_id || null,
                        payment_method: payment_method || "BOLETO",
                        interest,
                        discount,
                        totalValue: totalValue !== null ? totalValue : (isConfirmed ? item.amount : null),
                        credit_card_id: credit_card_id || null,
                    } as any
                })
            }

            if (!firstTransaction) throw new Error("Failed to create transaction");

            // SIDE EFFECTS (Balance & Transfer) - Applied to the First Transaction
            // If the first transaction is confirmed, update the balance.
            if (firstTransaction.confirmed && firstTransaction.account_id) {
                const effectiveAmount = firstTransaction.totalValue ?? firstTransaction.amount;
                await this.accountsRepository.changeBalance(firstTransaction.account_id, effectiveAmount, isIncome, tx)
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


