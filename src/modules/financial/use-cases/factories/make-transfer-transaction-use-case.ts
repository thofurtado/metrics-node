import { PrismaTransferTransactionsRepository } from '@/modules/financial/repositories/prisma/prisma-transfer-transactions-repository'
import { TransferTransactionUseCase } from '@/modules/financial/use-cases/transferTransaction'
import { PrismaTransactionsRepository } from '@/modules/financial/repositories/prisma/prisma-transactions-repository'
import { PrismaAccountsRepository } from '@/modules/financial/repositories/prisma/prisma-accounts-repository'




export function makeTransferTransactionuseCase() {
    const transferTransctionsRepository = new PrismaTransferTransactionsRepository()
    const transctionsRepository = new PrismaTransactionsRepository()
    const accountsRepository = new PrismaAccountsRepository()
    const transferTransctionUseCase = new TransferTransactionUseCase(transferTransctionsRepository, transctionsRepository, accountsRepository)
    return transferTransctionUseCase
}
