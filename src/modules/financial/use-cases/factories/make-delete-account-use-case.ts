import { PrismaAccountsRepository } from "@/modules/financial/repositories/prisma/prisma-accounts-repository"
import { DeleteAccountUseCase } from "@/modules/financial/use-cases/delete-account"

export function MakeDeleteAccountUseCase() {
    const accountsRepository = new PrismaAccountsRepository()
    const deleteAccountUseCase = new DeleteAccountUseCase(accountsRepository)

    return deleteAccountUseCase
}
