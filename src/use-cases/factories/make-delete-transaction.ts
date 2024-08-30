import { DeleteTransactionUseCase } from '../delete-transaction'
import { PrismaTransactionsRepository } from '@/repositories/prisma/prisma-transactions-repository'




export function MakeDeleteTransactionUseCase() {
    const transactionsRepository = new PrismaTransactionsRepository()
    const treatmentItemUseCase = new DeleteTransactionUseCase(
        transactionsRepository
    )
    return treatmentItemUseCase
}
