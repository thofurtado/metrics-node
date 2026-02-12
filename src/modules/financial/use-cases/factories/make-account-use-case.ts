import { PrismaAccountsRepository } from '@/modules/financial/repositories/prisma/prisma-accounts-repository'
import { AccountUseCase } from '@/modules/financial/use-cases/account'




export function MakeAccountUseCase() {
    const accountsRepository = new PrismaAccountsRepository()
    const accountUseCase = new AccountUseCase(accountsRepository)
    return accountUseCase
}
