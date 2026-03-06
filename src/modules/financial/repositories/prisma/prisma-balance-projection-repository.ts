// repositories/prisma/prisma-balance-projection-repository.ts
import { Prisma } from '@prisma/client'
import { BalanceProjectionRepository, BalanceProjectionData, DailyBalance } from '@/modules/financial/repositories/balance-projection-repository'
import { prisma } from '@/lib/prisma'

export class PrismaBalanceProjectionRepository implements BalanceProjectionRepository {
    async getBalanceProjection(days: number = 30): Promise<BalanceProjectionData> {
        const currentDate = new Date()
        const today = new Date(currentDate.getFullYear(), currentDate.getMonth(), currentDate.getDate())

        // 1. Buscar saldo atual das contas
        const accounts = await prisma.account.findMany({
            select: {
                balance: true
            }
        })

        const currentBalance = accounts.reduce((sum, account) => sum + account.balance, 0)

        // 2. Buscar TODAS as transações futuras (a partir de hoje)
        const endDate = new Date(today)
        endDate.setDate(endDate.getDate() + days)

        const futureTransactions = await prisma.transaction.findMany({
            where: {
                data_vencimento: {
                    gte: today, // Apenas a partir de hoje
                    lte: endDate
                }
            },
            select: {
                data_vencimento: true,
                operation: true,
                amount: true,
                confirmed: true
            },
            orderBy: {
                data_vencimento: 'asc'
            }
        })

        // 3. Gerar projeção apenas com dias que tenham transações
        const dailyBalances = this.generateDailyBalances(
            currentBalance,
            today,
            endDate,
            futureTransactions
        )

        return {
            currentBalance,
            dailyBalances
        }
    }

    private generateDailyBalances(
        initialBalance: number,
        startDate: Date,
        endDate: Date,
        transactions: { data_vencimento: Date; operation: string; amount: number; confirmed: boolean }[]
    ): DailyBalance[] {
        const dailyBalances: DailyBalance[] = []
        let runningBalance = initialBalance
        const today = new Date()

        // SEMPRE incluir hoje (dia 0)
        const todayString = today.toISOString().split('T')[0]
        const todayTransactions = transactions.filter(t =>
            new Date(t.data_vencimento).toISOString().split('T')[0] === todayString
        )

        // Calcular saldo de hoje
        const todayBalanceChange = todayTransactions.reduce((sum, transaction) => {
            if (transaction.operation === 'income') {
                return sum + transaction.amount
            } else {
                return sum - transaction.amount
            }
        }, 0)

        runningBalance += todayBalanceChange

        dailyBalances.push({
            date: todayString,
            balance: runningBalance,
            isProjection: todayTransactions.some(t => !t.confirmed) // Projeção se tiver pendentes
        })

        // Agrupar transações por dia
        const transactionsByDate = new Map<string, typeof transactions>()

        transactions.forEach(transaction => {
            const dateString = new Date(transaction.data_vencimento).toISOString().split('T')[0]
            if (!transactionsByDate.has(dateString)) {
                transactionsByDate.set(dateString, [])
            }
            transactionsByDate.get(dateString)!.push(transaction)
        })

        // Processar apenas dias que tenham transações (excluindo hoje que já processamos)
        const uniqueDates = Array.from(transactionsByDate.keys())
            .filter(dateString => dateString !== todayString)
            .sort()

        // Limitar aos próximos 30 dias
        const limitedDates = uniqueDates.slice(0, 29) // Hoje + 29 dias = 30 dias total

        // Calcular saldo para cada dia com transações
        limitedDates.forEach(dateString => {
            const dayTransactions = transactionsByDate.get(dateString) || []

            const dayBalanceChange = dayTransactions.reduce((sum, transaction) => {
                if (transaction.operation === 'income') {
                    return sum + transaction.amount
                } else {
                    return sum - transaction.amount
                }
            }, 0)

            runningBalance += dayBalanceChange

            const date = new Date(dateString)
            const isFutureDate = date > today
            const hasPendingTransactions = dayTransactions.some(t => !t.confirmed)
            const isProjection = isFutureDate || hasPendingTransactions

            dailyBalances.push({
                date: dateString,
                balance: runningBalance,
                isProjection
            })
        })

        return dailyBalances
    }
}