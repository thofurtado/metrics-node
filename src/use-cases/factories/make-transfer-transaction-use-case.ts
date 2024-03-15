import { PrismaTransferTransactionsRepository } from '@/repositories/prisma/prisma-transfer-transactions-repository'
import { TransferTransactionUseCase } from '../transferTransaction'
import { PrismaTransactionsRepository } from '@/repositories/prisma/prisma-transactions-repository'
import { PrismaAccountsRepository } from '@/repositories/prisma/prisma-accounts-repository'




export function makeTransferTransactionuseCase() {
    const transferTransctionsRepository = new PrismaTransferTransactionsRepository()
    const transctionsRepository = new PrismaTransactionsRepository()
    const accountsRepository = new PrismaAccountsRepository()
    const transferTransctionUseCase = new TransferTransactionUseCase(transferTransctionsRepository, transctionsRepository, accountsRepository)
    return transferTransctionUseCase
}
