import { PrismaAccountsRepository } from '@/repositories/prisma/prisma-accounts-repository'
import { AccountUseCase } from '../account'




export function MakeAccountUseCase() {
    const accountsRepository = new PrismaAccountsRepository()
    const accountUseCase = new AccountUseCase(accountsRepository)
    return accountUseCase
}
