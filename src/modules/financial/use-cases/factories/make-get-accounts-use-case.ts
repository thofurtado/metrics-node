
import { PrismaAccountsRepository } from '@/modules/financial/repositories/prisma/prisma-accounts-repository'
import { GetAccountsUseCase } from '@/modules/financial/use-cases/get-accounts'

export function MakeGetAccountsUseCase() {
    const accountsRepository = new PrismaAccountsRepository()
    const getAccountUseCase = new GetAccountsUseCase(accountsRepository)
    return getAccountUseCase
}
