import { TransactionsRepository } from '@/modules/financial/repositories/transactions-repository'
import { Transaction } from '@prisma/client'
import { ResourceNotFoundError } from '@/errors/resource-not-found-error'
import { AccountsRepository } from '@/modules/financial/repositories/accounts-repository'
import { prisma } from '@/lib/prisma'

interface UpdateTransactionUseCaseRequest {
    id: string;
    amount?: number;
    account_id?: string | null;
    data_vencimento?: Date | null;
    data_emissao?: Date | null;
    sector_id?: string | null;
    description?: string | null;
    confirmed?: boolean | null;
    supplier_id?: string | null;
    payment_method?: string | null;
}

interface UpdateTransactionUseCaseResponse {
    transaction: Transaction
}

export class UpdateTransactionUseCase {
    constructor(
        private transactionsRepository: TransactionsRepository,
        private accountsRepository: AccountsRepository
    ) { }

    async execute({
        id, amount, account_id, data_vencimento, data_emissao, sector_id, description, confirmed, supplier_id, payment_method
    }: UpdateTransactionUseCaseRequest): Promise<UpdateTransactionUseCaseResponse> {
        const transaction = await this.transactionsRepository.findById(id)

        if (!transaction) {
            throw new ResourceNotFoundError()
        }

        // Logic for balance adjustment
        // We only adjust balance if the transaction IS confirmed (either before or after the update)
        
        return await prisma.$transaction(async (tx) => {
            const oldAmount = transaction.totalValue ?? transaction.amount
            const oldConfirmed = transaction.confirmed
            const oldAccountId = transaction.account_id
            const oldOperation = transaction.operation

            // New values (fallback to old ones if not provided)
            const newConfirmed = confirmed !== undefined ? (confirmed ?? false) : oldConfirmed
            const newAmount = amount !== undefined ? amount : transaction.amount
            const newAccountId = account_id !== undefined ? account_id : oldAccountId

            // 1. Handle Balance Reversion (if it was confirmed)
            if (oldConfirmed && oldAccountId) {
                const isIncome = oldOperation === 'income'
                await this.accountsRepository.changeBalance(oldAccountId, oldAmount, !isIncome, tx)
            }

            // 2. Update the transaction
            const updatedTransaction = await tx.transaction.update({
                where: { id },
                data: {
                    amount: newAmount,
                    totalValue: newConfirmed ? (confirmed === undefined && amount === undefined ? transaction.totalValue : newAmount) : null,
                    account_id: newAccountId,
                    data_vencimento: data_vencimento !== undefined ? data_vencimento : transaction.data_vencimento,
                    data_emissao: data_emissao !== undefined ? data_emissao : transaction.data_emissao,
                    sector_id: sector_id !== undefined ? sector_id : transaction.sector_id,
                    description: description !== undefined ? description : transaction.description,
                    confirmed: newConfirmed,
                    supplier_id: supplier_id !== undefined ? supplier_id : transaction.supplier_id,
                    payment_method: payment_method !== undefined ? (payment_method || "BOLETO") : transaction.payment_method,
                }
            })

            // 3. Apply New Balance (if it is now confirmed)
            if (newConfirmed && newAccountId) {
                const isIncome = oldOperation === 'income'
                await this.accountsRepository.changeBalance(newAccountId, newAmount, isIncome, tx)
            }

            return {
                transaction: updatedTransaction
            }
        })
    }
}
