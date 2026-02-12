import { PrismaTransactionsRepository } from "@/modules/financial/repositories/prisma/prisma-transactions-repository";
import { RevertTransactionStatusUseCase } from "@/modules/financial/use-cases/revert-transaction-status";

export function MakeRevertTransactionStatusUseCase() {
    const transactionsRepository = new PrismaTransactionsRepository()
    const revertTransactionStatusUseCase = new RevertTransactionStatusUseCase(transactionsRepository)

    return revertTransactionStatusUseCase
}
