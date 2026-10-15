import { prisma } from '@/lib/prisma'
import { Prisma } from '@prisma/client'
import { AccountLinks, AccountsRepository } from '@/modules/financial/repositories/accounts-repository'

export class PrismaAccountsRepository implements AccountsRepository {


    async findMany() {
        const accounts = await prisma.account.findMany({
            orderBy: [
                {
                    name: 'asc'
                }
            ],
        })

        const pendingBalances = await prisma.transaction.groupBy({
            by: ['account_id'],
            where: {
                confirmed: false,
                operation: 'income'
            },
            _sum: {
                amount: true
            }
        })

        const pendingMap = new Map(pendingBalances.map(pb => [pb.account_id, pb._sum.amount || 0]))

        return accounts.map(account => ({
            ...account,
            pending_balance: pendingMap.get(account.id) || 0
        }))
    }
    async create(data: Prisma.AccountCreateInput) {
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
    async findById(id: string) {

        const account = await prisma.account.findUnique({
            where: {
                id
            }
        })
        return account
    }
    async changeBalance(id: string, value: number, operationType: boolean, tx?: Prisma.TransactionClient) {

        // We cannot use this.findById(id) here because we need the transaction client context
        // and findById might not use it (unless we pass it there too, which we aren't doing yet)
        // But for update, we just need to know it works. 
        // Let's assume the caller has verified existence or we trust the update will fail if not found (Prisma throws or returns nothing).
        // Actually Prisma update throws if not found. 

        const client = tx ?? prisma

        try {
            await client.account.update({
                where: { id },
                data: {
                    balance: {
                        increment: operationType ? value : -value,
                    }
                }
            })
            return true
        } catch (e) {
            return false
        }
    }
    async update(id: string, data: Prisma.AccountUpdateInput): Promise<Prisma.AccountGetPayload<typeof data> | null> {
        const updatedAccount = await prisma.account.update({
            where: { id },
            data,
        })
        return updatedAccount
    }

    async delete(id: string): Promise<void> {
        // Mergulho 13:D2: os ajustes de saldo são o histórico da própria conta e o banco recusa apagar a conta com
        // eles (erro 500). Só chega aqui conta sem lançamento, cartão, forma de pagamento nem maquininha (countLinks).
        await prisma.$transaction([
            prisma.accountAdjustment.deleteMany({ where: { account_id: id } }),
            prisma.account.delete({ where: { id } }),
        ])
    }

    async countLinks(id: string): Promise<AccountLinks> {
        const [transactions, creditCards, paymentMethods, posMachines] = await Promise.all([
            prisma.transaction.count({ where: { account_id: id } }),
            prisma.creditCard.count({ where: { account_id: id } }),
            prisma.payment.count({ where: { account_id: id } }),
            prisma.pOSMachine.count({ where: { account_id: id } }),
        ])
        return { transactions, creditCards, paymentMethods, posMachines }
    }
}
