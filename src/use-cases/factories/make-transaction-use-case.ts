import { PrismaTransactionsRepository } from '@/repositories/prisma/prisma-transactions-repository'
import { TransactionUseCase } from '../transaction'
import { PrismaTransferTransactionsRepository } from '@/repositories/prisma/prisma-transfer-transactions-repository'
import { PrismaAccountsRepository } from '@/repositories/prisma/prisma-accounts-repository'


export function makeTransactionUseCase () {

    const transactionsRepository = new PrismaTransactionsRepository()
    const transferTransactionsRepository = new PrismaTransferTransactionsRepository()
    const accountsRepository= new PrismaAccountsRepository()

    const useCase = new TransactionUseCase(transactionsRepository, transferTransactionsRepository, accountsRepository)
    return useCase
}
