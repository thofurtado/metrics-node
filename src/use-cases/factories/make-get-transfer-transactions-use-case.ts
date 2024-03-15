
import { PrismaTransferTransactionsRepository } from '@/repositories/prisma/prisma-transfer-transactions-repository'
import { GetTransferTransactionsUseCase } from '../get-transfer-transactions'

export function MakeGetTransferTransactionsUseCase() {
    const transferTransactionsRepository = new PrismaTransferTransactionsRepository()
    const getTransferTransactionUseCase = new GetTransferTransactionsUseCase(transferTransactionsRepository)
    return getTransferTransactionUseCase
}
