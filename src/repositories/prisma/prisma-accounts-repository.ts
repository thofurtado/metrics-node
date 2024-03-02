import { prisma } from '@/lib/prisma'
import { Prisma } from '@prisma/client'
import { AccountsRepository } from '../accounts-repository'

export class PrismaAccountsRepository implements AccountsRepository {
    async create(data: Prisma.AccountCreateInput){
        const account = await prisma.account.create({
            data
        })
        return account
    }
    async findByName(name: string) {
        const account = await prisma.account.findFirst({
            where: {
                name
            }
        })
        return account
    }
    async findById(id: string){
        const account = await prisma.account.findUnique({
            where: {
                id
            }
        })
        return account
    }
    async changeBalance(id: string, value: number, operationType: boolean){
        const account = await this.findById(id)
        if(account) {
            //se for entrada acrescente, se for transferencia ou despesa sai
            operationType ? account.balance +=value : account.balance -=value
            return true
        }
        return false
    }



}
