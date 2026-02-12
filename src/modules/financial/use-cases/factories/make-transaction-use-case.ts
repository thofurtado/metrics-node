import { PrismaTransactionsRepository } from '@/modules/financial/repositories/prisma/prisma-transactions-repository'
import { TransactionUseCase } from '@/modules/financial/use-cases/transaction'
import { PrismaTransferTransactionsRepository } from '@/modules/financial/repositories/prisma/prisma-transfer-transactions-repository'
import { PrismaAccountsRepository } from '@/modules/financial/repositories/prisma/prisma-accounts-repository'


export function MakeTransactionUseCase () {

    const transactionsRepository = new PrismaTransactionsRepository()
    const transferTransactionsRepository = new PrismaTransferTransactionsRepository()
    const accountsRepository= new PrismaAccountsRepository()

    const useCase = new TransactionUseCase(transactionsRepository, transferTransactionsRepository, accountsRepository)
    return useCase
}
