import { DeleteTransactionUseCase } from '@/modules/financial/use-cases/delete-transaction'
import { PrismaTransactionsRepository } from '@/modules/financial/repositories/prisma/prisma-transactions-repository'




export function MakeDeleteTransactionUseCase() {
    const transactionsRepository = new PrismaTransactionsRepository()
    const treatmentItemUseCase = new DeleteTransactionUseCase(
        transactionsRepository
    )
    return treatmentItemUseCase
}
