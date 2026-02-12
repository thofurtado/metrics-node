import { AdjustAccountBalanceUseCase } from "@/modules/financial/use-cases/adjust-account-balance"
import { PrismaAccountsRepository } from "@/modules/financial/repositories/prisma/prisma-accounts-repository"

export function makeAdjustAccountBalanceUseCase() {
    const accountsRepository = new PrismaAccountsRepository()
    const useCase = new AdjustAccountBalanceUseCase(accountsRepository)
    return useCase
}
