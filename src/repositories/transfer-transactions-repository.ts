import { Prisma, TransferTransaction } from '@prisma/client'

export interface TransferTransactionsRepository {
    create(data: Prisma.TransferTransactionUncheckedCreateInput, tx?: Prisma.TransactionClient): Promise<TransferTransaction>
    findByAccount(account_id: string): Promise<TransferTransaction[] | null> // when an account receive money
    findMany(): Promise<(TransferTransaction & { accounts: unknown, transaction: unknown })[] | null>
    executeTransfer(data: {
        originTransactionId: string
        destinationAccountId: string
        amount: number
        originAccountName: string
    }): Promise<TransferTransaction>
}
