// ARQUIVO: src/repositories/in-memory/in-memory-financial-summary-service.spec.ts
import { describe, it, expect, beforeEach } from 'vitest'
import { GetFinancialSummaryUseCase } from '@/use-cases/get-financial-summary'
import { InMemoryTransactionsRepository } from '@/repositories/in-memory/in-memory-transactions-repository'
function makeTransaction(override: Partial<Transaction> = {}) {
    return {
        id: override.id ?? 'transaction-1',
        description: override.description ?? 'Test transaction',
        amount: override.amount ?? 100,
        operation: override.operation ?? 'income',
        date: override.date ?? new Date(),
        confirmed: override.confirmed ?? true,
        userId: override.userId ?? 'user-1',
        category: override.category ?? 'general',
        createdAt: override.createdAt ?? new Date(),
        updatedAt: override.updatedAt ?? new Date(),
    }
}

function getStartOfToday() {
    const date = new Date()
    date.setHours(0, 0, 0, 0)
    return date
}

function getDaysAgo(days: number) {
    const date = new Date()
    date.setDate(date.getDate() - days)
    return date
}

function getDaysFuture(days: number) {
    const date = new Date()
    date.setDate(date.getDate() + days)
    return date
}

function getTodayWithTime(hours: number, minutes: number = 0) {
    const date = new Date()
    date.setHours(hours, minutes, 0, 0)
    return date
}

describe('In Memory Financial Summary Service', () => {
    let service: InMemoryTransactionsRepository

    beforeEach(() => {
        service = new InMemoryTransactionsRepository()
    })

    it('should calculate correct financial summary with mixed transactions', async () => {
        const transactions = [
            // Transações confirmadas do mês atual
            makeTransaction({
                operation: 'income',
                amount: 1000,
                confirmed: true,
                date: new Date()
            }),
            makeTransaction({
                operation: 'expense',
                amount: 500,
                confirmed: true,
                date: new Date()
            }),
            // Transações pendentes do mês atual
            makeTransaction({
                operation: 'income',
                amount: 300,
                confirmed: false,
                date: new Date()
            }),
            makeTransaction({
                operation: 'expense',
                amount: 200,
                confirmed: false,
                date: new Date()
            }),
            // Transações de meses anteriores (não devem contar no monthly)
            makeTransaction({
                operation: 'income',
                amount: 800,
                confirmed: true,
                date: getDaysAgo(40)
            })
        ]

        service.items.push(...transactions)

        const summary = await service.getFinancialSummary()

        expect(summary.totalBalance).toBe(1300) // (1000 + 800) - 500
        expect(summary.monthlyIncome).toBe(1300) // 1000 + 300
        expect(summary.monthlyExpenses).toBe(700) // 500 + 200
        expect(summary.pendingIncome).toBe(300)
        expect(summary.pendingExpenses).toBe(200)
        expect(summary.overdueIncome).toBe(0)
        expect(summary.overdueExpenses).toBe(0)
    })

    it('should calculate overdue income and expenses correctly considering startOfToday', async () => {
        const startOfToday = getStartOfToday()

        const transactions = [
            // ✅ Income vencido (passado + não confirmado)
            makeTransaction({
                operation: 'income',
                amount: 500,
                confirmed: false,
                date: getDaysAgo(1) // Ontem (vencido)
            }),
            // ✅ Expense vencido (passado + não confirmado)
            makeTransaction({
                operation: 'expense',
                amount: 300,
                confirmed: false,
                date: getDaysAgo(5) // 5 dias atrás (vencido)
            }),
            // ❌ Income HOJE (não deve contar como vencido, mesmo sendo horário menor)
            makeTransaction({
                operation: 'income',
                amount: 200,
                confirmed: false,
                date: getTodayWithTime(10, 0) // Hoje 10:00 (NÃO vencido)
            }),
            // ❌ Income futuro (não deve contar como vencido)
            makeTransaction({
                operation: 'income',
                amount: 150,
                confirmed: false,
                date: getDaysFuture(1) // Amanhã (NÃO vencido)
            }),
            // ❌ Income confirmado (não deve contar como vencido, mesmo sendo passado)
            makeTransaction({
                operation: 'income',
                amount: 400,
                confirmed: true,
                date: getDaysAgo(10)
            })
        ]

        service.items.push(...transactions)

        const summary = await service.getFinancialSummary()

        // Apenas transações não confirmadas com data ANTERIOR a startOfToday
        expect(summary.overdueIncome).toBe(500)
        expect(summary.overdueExpenses).toBe(300)
    })

    it('should NOT include today transactions in overdue calculations', async () => {
        const transactions = [
            // ❌ HOJE 00:00 (não vencido)
            makeTransaction({
                operation: 'income',
                amount: 100,
                confirmed: false,
                date: getStartOfToday()
            }),
            // ❌ HOJE 10:00 (não vencido)
            makeTransaction({
                operation: 'income',
                amount: 200,
                confirmed: false,
                date: getTodayWithTime(10, 0)
            }),
            // ❌ HOJE 23:59 (não vencido)
            makeTransaction({
                operation: 'expense',
                amount: 300,
                confirmed: false,
                date: getTodayWithTime(23, 59)
            }),
            // ✅ ONTEM 23:59 (vencido)
            makeTransaction({
                operation: 'income',
                amount: 400,
                confirmed: false,
                date: new Date(getStartOfToday().getTime() - 1) // 1ms antes de hoje 00:00
            })
        ]

        service.items.push(...transactions)

        const summary = await service.getFinancialSummary()

        // Apenas a transação de ONTEM deve contar como vencida
        expect(summary.overdueIncome).toBe(400)
        expect(summary.overdueExpenses).toBe(0)
    })

    it('should handle empty transactions array', async () => {
        const summary = await service.getFinancialSummary()

        expect(summary.totalBalance).toBe(0)
        expect(summary.monthlyIncome).toBe(0)
        expect(summary.monthlyExpenses).toBe(0)
        expect(summary.pendingIncome).toBe(0)
        expect(summary.pendingExpenses).toBe(0)
        expect(summary.overdueIncome).toBe(0)
        expect(summary.overdueExpenses).toBe(0)
    })

    it('should calculate balance correctly with only expenses', async () => {
        const transactions = [
            makeTransaction({
                operation: 'expense',
                amount: 1000,
                confirmed: true,
                date: new Date()
            }),
            makeTransaction({
                operation: 'expense',
                amount: 500,
                confirmed: true,
                date: new Date()
            })
        ]

        service.items.push(...transactions)

        const summary = await service.getFinancialSummary()

        expect(summary.totalBalance).toBe(-1500)
        expect(summary.monthlyExpenses).toBe(1500)
        expect(summary.monthlyIncome).toBe(0)
    })

    it('should calculate balance correctly with only income', async () => {
        const transactions = [
            makeTransaction({
                operation: 'income',
                amount: 2000,
                confirmed: true,
                date: new Date()
            }),
            makeTransaction({
                operation: 'income',
                amount: 800,
                confirmed: true,
                date: new Date()
            })
        ]

        service.items.push(...transactions)

        const summary = await service.getFinancialSummary()

        expect(summary.totalBalance).toBe(2800)
        expect(summary.monthlyIncome).toBe(2800)
        expect(summary.monthlyExpenses).toBe(0)
    })

    it('should only include current month transactions in monthly calculations', async () => {
        const currentDate = new Date()
        const lastMonth = new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 15)
        const nextMonth = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 15)

        const transactions = [
            // Mês atual
            makeTransaction({
                operation: 'income',
                amount: 1000,
                confirmed: true,
                date: currentDate
            }),
            // Mês anterior
            makeTransaction({
                operation: 'income',
                amount: 500,
                confirmed: true,
                date: lastMonth
            }),
            // Próximo mês
            makeTransaction({
                operation: 'income',
                amount: 300,
                confirmed: true,
                date: nextMonth
            })
        ]

        service.items.push(...transactions)

        const summary = await service.getFinancialSummary()

        expect(summary.monthlyIncome).toBe(1000)
        expect(summary.totalBalance).toBe(1800) // 1000 + 500 + 300
    })

    it('should correctly identify pending transactions of current month', async () => {
        const transactions = [
            // Pendentes do mês atual
            makeTransaction({
                operation: 'income',
                amount: 400,
                confirmed: false,
                date: new Date()
            }),
            makeTransaction({
                operation: 'expense',
                amount: 250,
                confirmed: false,
                date: new Date()
            }),
            // Confirmadas do mês atual
            makeTransaction({
                operation: 'income',
                amount: 600,
                confirmed: true,
                date: new Date()
            }),
            // Pendentes de outros meses (não devem contar no pending do mês)
            makeTransaction({
                operation: 'income',
                amount: 100,
                confirmed: false,
                date: getDaysAgo(40)
            })
        ]

        service.items.push(...transactions)

        const summary = await service.getFinancialSummary()

        expect(summary.pendingIncome).toBe(400)
        expect(summary.pendingExpenses).toBe(250)
        expect(summary.monthlyIncome).toBe(1000) // 600 + 400
        expect(summary.monthlyExpenses).toBe(250)
    })

    it('should handle transactions with zero amount', async () => {
        const transactions = [
            makeTransaction({
                operation: 'income',
                amount: 0,
                confirmed: true,
                date: new Date()
            }),
            makeTransaction({
                operation: 'expense',
                amount: 0,
                confirmed: false,
                date: new Date()
            })
        ]

        service.items.push(...transactions)

        const summary = await service.getFinancialSummary()

        expect(summary.totalBalance).toBe(0)
        expect(summary.monthlyIncome).toBe(0)
        expect(summary.monthlyExpenses).toBe(0)
        expect(summary.pendingIncome).toBe(0)
        expect(summary.pendingExpenses).toBe(0)
        expect(summary.overdueIncome).toBe(0)
        expect(summary.overdueExpenses).toBe(0)
    })

    it('should include overdue from all previous months, not just current month', async () => {
        const transactions = [
            // Vencidos de meses anteriores
            makeTransaction({
                operation: 'income',
                amount: 1000,
                confirmed: false,
                date: getDaysAgo(60) // 2 meses atrás
            }),
            makeTransaction({
                operation: 'expense',
                amount: 750,
                confirmed: false,
                date: getDaysAgo(90) // 3 meses atrás
            }),
            // Pendentes do mês atual (não vencidos)
            makeTransaction({
                operation: 'income',
                amount: 500,
                confirmed: false,
                date: new Date() // Hoje
            })
        ]

        service.items.push(...transactions)

        const summary = await service.getFinancialSummary()

        // Apenas transações de meses anteriores devem contar como vencidas
        expect(summary.overdueIncome).toBe(1000)
        expect(summary.overdueExpenses).toBe(750)
        // Pendentes do mês atual não são vencidos
        expect(summary.pendingIncome).toBe(500)
    })
})