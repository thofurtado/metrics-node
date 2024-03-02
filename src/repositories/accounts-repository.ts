import { Account, Prisma } from '@prisma/client'

export interface AccountsRepository {
    create(date: Prisma.AccountCreateInput):Promise<Account>
    findByName(name:string):Promise<Account | null>
    findById(id:string):Promise<Account | null>
    changeBalance(id: string, value:number, operationType: boolean):Promise<null>
}
