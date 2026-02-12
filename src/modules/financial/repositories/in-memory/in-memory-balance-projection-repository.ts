// repositories/in-memory/in-memory-balance-projection-repository.ts
import { BalanceProjectionRepository, BalanceProjectionData, DailyBalance } from '@/modules/financial/repositories/balance-projection-repository'
import { Account, Transaction } from '@prisma/client'

export class InMemoryBalanceProjectionRepository implements BalanceProjectionRepository {
    public accounts: Account[] = []
    public transactions: Transaction[] = []

    async getBalanceProjection(days: number = 30): Promise<BalanceProjectionData> {
        const currentDate = new Date()
        const today = new Date(currentDate.getFullYear(), currentDate.getMonth(), currentDate.getDate())

        // 1. Saldo atual REAL das contas
        const currentBalance = this.accounts.reduce((sum, account) => sum + account.balance, 0)

        // 2. Buscar TODAS as transações futuras (a partir de hoje)
        const endDate = new Date(today)
        endDate.setDate(endDate.getDate() + days)

        const futureTransactions = this.transactions.filter(transaction => {
            const transactionDate = new Date(transaction.date)
            return transactionDate >= today && transactionDate <= endDate
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
        transactions: Transaction[]
    ): DailyBalance[] {
        const dailyBalances: DailyBalance[] = []
        let runningBalance = initialBalance
        const today = new Date()

        // SEMPRE incluir hoje (dia 0)
        const todayString = today.toISOString().split('T')[0]
        const todayTransactions = transactions.filter(t =>
            new Date(t.date).toISOString().split('T')[0] === todayString
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
            isProjection: todayTransactions.some(t => !t.confirmed)
        })

        // Agrupar transações por dia (excluindo hoje)
        const transactionsByDate = new Map<string, Transaction[]>()

        transactions.forEach(transaction => {
            const dateString = new Date(transaction.date).toISOString().split('T')[0]
            if (dateString !== todayString) {
                if (!transactionsByDate.has(dateString)) {
                    transactionsByDate.set(dateString, [])
                }
                transactionsByDate.get(dateString)!.push(transaction)
            }
        })

        // Processar apenas dias que tenham transações, ordenados por data
        const uniqueDates = Array.from(transactionsByDate.keys()).sort()
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

    // Métodos auxiliares para testes
    createAccount(account: Partial<Account>): Account {
        const newAccount: Account = {
            id: account.id || `account-${this.accounts.length + 1}`,
            name: account.name || 'Default Account',
            description: account.description || null,
            balance: account.balance || 0,
            goal: account.goal || null,
            ...account
        }

        this.accounts.push(newAccount)
        return newAccount
    }

    createTransaction(transaction: Partial<Transaction>): Transaction {
        const newTransaction: Transaction = {
            id: transaction.id || `transaction-${this.transactions.length + 1}`,
            operation: transaction.operation || 'income',
            date: transaction.date || new Date(),
            amount: transaction.amount || 0,
            account_id: transaction.account_id || 'account-1',
            sector_id: transaction.sector_id || null,
            description: transaction.description || null,
            confirmed: transaction.confirmed !== undefined ? transaction.confirmed : true,
            ...transaction
        }

        this.transactions.push(newTransaction)
        return newTransaction
    }

    clearAll() {
        this.accounts = []
        this.transactions = []
    }
}