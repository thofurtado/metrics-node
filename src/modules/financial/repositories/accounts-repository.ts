import { Account, Prisma } from '@prisma/client'

export interface AccountsRepository {
    create(data: Prisma.AccountCreateInput): Promise<Account>
    findByName(name: string): Promise<Account | null>
    findById(id: string): Promise<Account | null>
    changeBalance(id: string, value: number, operationType: boolean, tx?: Prisma.TransactionClient): Promise<boolean>
    findMany(): Promise<(Account & { pending_balance?: number })[]>
    update(id: string, data: Prisma.AccountUpdateInput): Promise<Account | null>
    delete(id: string): Promise<void>
    /** Quantos registros ainda usam a conta (Mergulho 13:D2: excluir não pode soltar o histórico). */
    countLinks(id: string): Promise<AccountLinks>
}

export interface AccountLinks {
    transactions: number
    creditCards: number
    paymentMethods: number
    posMachines: number
}
