import { PrismaAccountsRepository } from "@/repositories/prisma/prisma-accounts-repository"
import { UpdateAccountUseCase } from "../update-account"

export function MakeUpdateAccountUseCase() {
    const accountsRepository = new PrismaAccountsRepository()
    const updateAccountUseCase = new UpdateAccountUseCase(accountsRepository)

    return updateAccountUseCase
}
