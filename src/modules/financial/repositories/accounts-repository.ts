import { Account, Prisma } from '@prisma/client'

export interface AccountsRepository {
    create(data: Prisma.AccountCreateInput): Promise<Account>
    findByName(name: string): Promise<Account | null>
    findById(id: string): Promise<Account | null>
    changeBalance(id: string, value: number, operationType: boolean, tx?: Prisma.TransactionClient): Promise<boolean>
    findMany(): Promise<(Account & { pending_balance?: number })[]>
    update(id: string, data: Prisma.AccountUpdateInput): Promise<Account | null>
    delete(id: string): Promise<void>
}
