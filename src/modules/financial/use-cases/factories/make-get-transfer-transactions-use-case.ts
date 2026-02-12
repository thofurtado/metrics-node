
import { PrismaTransferTransactionsRepository } from '@/modules/financial/repositories/prisma/prisma-transfer-transactions-repository'
import { GetTransferTransactionsUseCase } from '@/modules/financial/use-cases/get-transfer-transactions'

export function MakeGetTransferTransactionsUseCase() {
    const transferTransactionsRepository = new PrismaTransferTransactionsRepository()
    const getTransferTransactionUseCase = new GetTransferTransactionsUseCase(transferTransactionsRepository)
    return getTransferTransactionUseCase
}
