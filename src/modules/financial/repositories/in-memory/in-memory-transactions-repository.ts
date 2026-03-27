import { Transaction, Prisma } from '@prisma/client'
import { TransactionsRepository } from '@/modules/financial/repositories/transactions-repository'
import { randomUUID } from 'node:crypto'
import { FinancialSummaryData } from '@/modules/financial/repositories/DTO/get-financial-dashboard-dto'
import { ChangeTransactionStatusParams } from '@/modules/financial/repositories/DTO/change-transaction-status-params-dto'

export class InMemoryTransactionsRepository implements TransactionsRepository {
    public items: (Transaction & { [key: string]: any })[] = []

    async getFinancialSummary(): Promise<FinancialSummaryData> {
        const currentDate = new Date()
        const currentYear = currentDate.getFullYear()
        const currentMonth = currentDate.getMonth()
        const startOfMonth = new Date(currentYear, currentMonth, 1)
        const startOfNextMonth = new Date(currentYear, currentMonth + 1, 1)

        // 🔥 CORREÇÃO: Criar startOfToday (00:00:00 do dia atual)
        const startOfToday = new Date(currentDate)
        startOfToday.setHours(0, 0, 0, 0)

        // Filtrar transações do mês atual
        const currentMonthTransactions = this.items.filter(transaction => {
            const transactionDate = new Date(transaction.data_vencimento)
            return transactionDate >= startOfMonth && transactionDate < startOfNextMonth
        })

        // Saldo total (todas as transações confirmadas - histórico completo)
        const totalBalance = this.items
            .filter(t => t.confirmed)
            .reduce((sum, transaction) => {
                return transaction.operation === 'income'
                    ? sum + transaction.amount
                    : sum - transaction.amount
            }, 0)

        // Entradas totais do mês (confirmadas + pendentes)
        const monthlyIncome = currentMonthTransactions
            .filter(t => t.operation === 'income')
            .reduce((sum, t) => sum + t.amount, 0)

        // Saídas totais do mês (confirmadas + pendentes)
        const monthlyExpenses = currentMonthTransactions
            .filter(t => t.operation === 'expense')
            .reduce((sum, t) => sum + t.amount, 0)

        // Total a receber do mês (pendentes)
        const pendingIncome = currentMonthTransactions
            .filter(t => t.operation === 'income' && !t.confirmed)
            .reduce((sum, t) => sum + t.amount, 0)

        // Total a pagar do mês (pendentes)
        const pendingExpenses = currentMonthTransactions
            .filter(t => t.operation === 'expense' && !t.confirmed)
            .reduce((sum, t) => sum + t.amount, 0)

        // 🔥 CORREÇÃO: A receber vencido (todos os meses - não confirmado e data ANTERIOR a startOfToday)
        const overdueIncome = this.items
            .filter(t => t.operation === 'income' && !t.confirmed && new Date(t.data_vencimento) < startOfToday)
            .reduce((sum, t) => sum + t.amount, 0)

        // 🔥 CORREÇÃO: A pagar vencido (todos os meses - não confirmado e data ANTERIOR a startOfToday)
        const overdueExpenses = this.items
            .filter(t => t.operation === 'expense' && !t.confirmed && new Date(t.data_vencimento) < startOfToday)
            .reduce((sum, t) => sum + t.amount, 0)

        return {
            totalBalance,
            monthlyIncome,
            monthlyExpenses,
            pendingIncome,
            pendingExpenses,
            overdueIncome,
            overdueExpenses
        }
    }

    // CORREÇÃO: findMany com a assinatura correta
    async findMany(
        month: Date,
        pageIndex?: number,
        perPage?: number,
        description?: string,
        value?: number,
        sector_id?: string,
        account_id?: string,
        status?: string,
        toDate?: Date,
        supplier_id?: string,
        operation?: string,
        fromDate?: Date
    ): Promise<{
        transactions: Transaction[];
        totalCount: number;
        perPage: number;
        pageIndex: number
    } | null> {

        // Filtragem básica por data e operação
        let filteredTransactions = this.items;

        const startOfToday = new Date();
        startOfToday.setHours(0, 0, 0, 0);

        if (status === 'overdue') {
            filteredTransactions = filteredTransactions.filter(t => 
                !t.confirmed && new Date(t.data_vencimento) < startOfToday
            );
        } else if (status === 'pending') {
            filteredTransactions = filteredTransactions.filter(t => !t.confirmed);
            
            if (toDate) {
                const limitDate = new Date(toDate);
                limitDate.setHours(23, 59, 59, 999);
                filteredTransactions = filteredTransactions.filter(t => new Date(t.data_vencimento) <= limitDate);
            }
            
            if (fromDate) {
                const startDate = new Date(fromDate);
                startDate.setHours(0, 0, 0, 0);
                filteredTransactions = filteredTransactions.filter(t => new Date(t.data_vencimento) >= startDate);
            }
        } else if (status === 'completed') {
            filteredTransactions = filteredTransactions.filter(t => t.confirmed);
            // Default history: current month
            filteredTransactions = filteredTransactions.filter(t => {
                const d = new Date(t.data_vencimento);
                return d.getFullYear() === month.getFullYear() && d.getMonth() === month.getMonth();
            });
        } else {
            // Default behaviour (History Flow)
            filteredTransactions = filteredTransactions.filter(t => {
                const d = new Date(t.data_vencimento);
                return d.getFullYear() === month.getFullYear() && d.getMonth() === month.getMonth();
            });
        }

        // Aplicar filtros adicionais
        if (operation) {
            filteredTransactions = filteredTransactions.filter(t => t.operation === operation);
        }

        if (sector_id && sector_id !== 'all') {
            filteredTransactions = filteredTransactions.filter(t => t.sector_id === sector_id)
        }

        if (account_id && account_id !== 'all') {
            filteredTransactions = filteredTransactions.filter(t => t.account_id === account_id)
        }

        if (supplier_id && supplier_id !== 'all') {
            filteredTransactions = filteredTransactions.filter(t => t.supplier_id === supplier_id)
        }

        if (description) {
            filteredTransactions = filteredTransactions.filter(t =>
                t.description?.toLowerCase().includes(description.toLowerCase())
            )
        }

        if (value) {
            filteredTransactions = filteredTransactions.filter(t => t.amount === value)
        }

        // Paginação
        const take = perPage || 6
        const skip = pageIndex ? (pageIndex - 1) * take : 0
        const paginatedTransactions = filteredTransactions.slice(skip, skip + take)

        return {
            transactions: paginatedTransactions,
            totalCount: filteredTransactions.length,
            perPage: take,
            pageIndex: pageIndex || 1
        }
    }

    async update(data: Prisma.TransactionUncheckedUpdateInput): Promise<Transaction> {
        const index = this.items.findIndex(item => item.id === data.id)
        if (index === -1) {
            throw new Error('Transaction not found')
        }

        const updateData: any = {
            operation: typeof data.operation === 'string' ? data.operation : this.items[index].operation,
            amount: typeof data.amount === 'number' ? data.amount : this.items[index].amount,
            account_id: typeof data.account_id === 'string' ? data.account_id : this.items[index].account_id,
            data_vencimento: data.data_vencimento ? new Date(data.data_vencimento as string) : this.items[index].data_vencimento,
            data_emissao: (data as any).data_emissao ? new Date((data as any).data_emissao as string) : this.items[index].data_emissao,
            sector_id: data.sector_id !== undefined
                ? (typeof data.sector_id === 'string' ? data.sector_id : null)
                : this.items[index].sector_id,
            description: data.description !== undefined
                ? (typeof data.description === 'string' ? data.description : null)
                : this.items[index].description,
            confirmed: typeof data.confirmed === 'boolean' ? data.confirmed : this.items[index].confirmed,
            supplier_id: (data as any).supplier_id !== undefined ? ((data as any).supplier_id as string | null) : this.items[index].supplier_id,
            parent_transaction_id: (data as any).parent_transaction_id !== undefined ? ((data as any).parent_transaction_id as string | null) : this.items[index].parent_transaction_id
        }

        const transactionId = typeof data.id === 'string' ? data.id : this.items[index].id

        const updatedTransaction: any = {
            ...this.items[index],
            ...updateData,
            id: transactionId
        }

        this.items[index] = updatedTransaction

        return updatedTransaction
    }

    async create(data: Prisma.TransactionUncheckedCreateInput) {
        const transaction: any = {
            id: data.id ? data.id as string : randomUUID(),
            operation: data.operation as string,
            amount: data.amount as number,
            account_id: data.account_id as string,
            data_vencimento: data.data_vencimento ? new Date(data.data_vencimento as string) : new Date(),
            data_emissao: (data as any).data_emissao ? new Date((data as any).data_emissao as string) : new Date(),
            sector_id: data.sector_id as string || null,
            description: data.description as string || null,
            confirmed: data.confirmed as boolean || false,
            created_at: new Date(),
            supplier_id: (data as any).supplier_id as string || null,
            parent_transaction_id: (data as any).parent_transaction_id as string || null
        }
        this.items.push(transaction)
        return transaction
    }

    async findById(id: string): Promise<Transaction | null> {
        const transaction = this.items.find(item => item.id === id)
        return transaction || null
    }

    // Implementação dos outros métodos necessários para a interface
    async getBalance(): Promise<number> {

        const confirmedTransactions = this.items.filter(t => t.confirmed)
        return confirmedTransactions.reduce((sum, transaction) => {
            return transaction.operation === 'income'
                ? sum + transaction.amount
                : sum - transaction.amount
        }, 0)
    }

    async getMonthIncomeByDays(): Promise<{ day: string; revenue: number; }[]> {
        // Implementação simplificada para in-memory
        const dailyIncomes = this.items
            .filter(t => t.operation === 'income')
            .reduce((acc, transaction) => {
                const day = transaction.data_vencimento.toISOString().substring(5, 10)
                acc[day] = (acc[day] || 0) + transaction.amount
                return acc
            }, {} as Record<string, number>)

        return Object.entries(dailyIncomes).map(([day, revenue]) => ({
            day,
            revenue
        }))
    }

    async getMonthExpenseBySector(): Promise<{ sector_name: string; amount: number; }[]> {
        // Implementação simplificada - usando sector_id como sector_name para testes
        const sectorExpenses = this.items
            .filter(t => t.operation === 'expense')
            .reduce((acc, transaction) => {
                const sectorName = transaction.sector_id || 'Sem setor'
                acc[sectorName] = (acc[sectorName] || 0) + transaction.amount
                return acc
            }, {} as Record<string, number>)

        return Object.entries(sectorExpenses).map(([sector_name, amount]) => ({
            sector_name,
            amount: Number(amount.toFixed(2))
        }))
    }

    async getMonthExpenseAmount(): Promise<{ monthExpenseAmount: number; diffFromLastMonth: number; alreadyPaid: number }> {
        const currentDate = new Date()
        const currentYear = currentDate.getFullYear()
        const currentMonth = currentDate.getMonth()

        const currentMonthExpenses = this.items.filter(t => {
            const transactionDate = new Date(t.data_vencimento)
            return transactionDate >= new Date(currentYear, currentMonth, 1) &&
                transactionDate < new Date(currentYear, currentMonth + 1, 1) &&
                t.operation === 'expense'
        })

        const monthExpenseAmount = currentMonthExpenses.reduce((sum, t) => sum + t.amount, 0)
        const alreadyPaid = currentMonthExpenses
            .filter(t => t.confirmed)
            .reduce((sum, t) => sum + t.amount, 0)

        return {
            monthExpenseAmount,
            alreadyPaid,
            diffFromLastMonth: 0 // Simplificado para testes
        }
    }

    async getMonthIncomeAmount(): Promise<{ monthIncomeAmount: number; diffFromLastMonth: number; alreadyPaid: number }> {
        const currentDate = new Date()
        const currentYear = currentDate.getFullYear()
        const currentMonth = currentDate.getMonth()

        const currentMonthIncomes = this.items.filter(t => {
            const transactionDate = new Date(t.data_vencimento)
            return transactionDate >= new Date(currentYear, currentMonth, 1) &&
                transactionDate < new Date(currentYear, currentMonth + 1, 1) &&
                t.operation === 'income'
        })

        const monthIncomeAmount = currentMonthIncomes.reduce((sum, t) => sum + t.amount, 0)
        const alreadyPaid = currentMonthIncomes
            .filter(t => t.confirmed)
            .reduce((sum, t) => sum + t.amount, 0)

        return {
            monthIncomeAmount,
            alreadyPaid,
            diffFromLastMonth: 0 // Simplificado para testes
        }
    }

    async delete(id: string): Promise<void> {
        const index = this.items.findIndex(item => item.id === id)
        if (index !== -1) {
            this.items.splice(index, 1)
        }
    }

    async changeTransactionStatus(data: ChangeTransactionStatusParams): Promise<void> {
        const transactionIndex = this.items.findIndex(item => item.id === data.id)
        if (transactionIndex !== -1) {
            this.items[transactionIndex].confirmed = !this.items[transactionIndex].confirmed
            this.items[transactionIndex].amount = data.amount
            this.items[transactionIndex].data_vencimento = data.date
        }
    }

    async revertTransactionStatus(id: string): Promise<void> {
        const transactionIndex = this.items.findIndex(item => item.id === id)
        if (transactionIndex !== -1) {
            this.items[transactionIndex].confirmed = !this.items[transactionIndex].confirmed
        }
    }

    async markAsPaidMany(ids: string[]): Promise<void> {
        ids.forEach(id => {
            const index = this.items.findIndex(item => item.id === id)
            if (index !== -1 && !this.items[index].confirmed) {
                this.items[index].confirmed = true
            }
        })
    }
}