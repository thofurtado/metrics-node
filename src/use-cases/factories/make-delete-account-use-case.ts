import { PrismaAccountsRepository } from "@/repositories/prisma/prisma-accounts-repository"
import { DeleteAccountUseCase } from "../delete-account"

export function MakeDeleteAccountUseCase() {
    const accountsRepository = new PrismaAccountsRepository()
    const deleteAccountUseCase = new DeleteAccountUseCase(accountsRepository)

    return deleteAccountUseCase
}
