import { PrismaTransactionsRepository } from "@/repositories/prisma/prisma-transactions-repository";
import { RevertTransactionStatusUseCase } from "../revert-transaction-status";

export function MakeRevertTransactionStatusUseCase() {
    const transactionsRepository = new PrismaTransactionsRepository()
    const revertTransactionStatusUseCase = new RevertTransactionStatusUseCase(transactionsRepository)

    return revertTransactionStatusUseCase
}
