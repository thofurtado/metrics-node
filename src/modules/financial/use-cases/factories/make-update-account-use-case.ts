import { PrismaAccountsRepository } from "@/modules/financial/repositories/prisma/prisma-accounts-repository"
import { UpdateAccountUseCase } from "@/modules/financial/use-cases/update-account"

export function MakeUpdateAccountUseCase() {
    const accountsRepository = new PrismaAccountsRepository()
    const updateAccountUseCase = new UpdateAccountUseCase(accountsRepository)

    return updateAccountUseCase
}
