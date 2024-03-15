
import { PrismaAccountsRepository } from '@/repositories/prisma/prisma-accounts-repository'
import { GetAccountsUseCase } from '../get-accounts'

export function MakeGetAccountsUseCase() {
    const accountsRepository = new PrismaAccountsRepository()
    const getAccountUseCase = new GetAccountsUseCase(accountsRepository)
    return getAccountUseCase
}
