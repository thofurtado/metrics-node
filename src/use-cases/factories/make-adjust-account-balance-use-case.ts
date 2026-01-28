import { AdjustAccountBalanceUseCase } from "../adjust-account-balance"
import { PrismaAccountsRepository } from "@/repositories/prisma/prisma-accounts-repository"

export function makeAdjustAccountBalanceUseCase() {
    const accountsRepository = new PrismaAccountsRepository()
    const useCase = new AdjustAccountBalanceUseCase(accountsRepository)
    return useCase
}
