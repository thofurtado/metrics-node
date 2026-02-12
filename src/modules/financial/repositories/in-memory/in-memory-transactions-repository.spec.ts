import { expect, describe, it, beforeEach } from 'vitest'
import { InMemoryTransactionsRepository } from '@/modules/financial/repositories/in-memory/in-memory-transactions-repository'

let sut: InMemoryTransactionsRepository

describe('InMemoryTransactionsRepository', () => {
    beforeEach(() => {
        sut = new InMemoryTransactionsRepository()
    })

    describe('getFinancialSummary', () => {
        it('should calculate total balance correctly based on confirmed transactions', async () => {
            // Setup:
            // +1000 confirmed income
            // -300 confirmed expense
            // +200 PENDING income (should not affect total balance)
            await sut.create({
                amount: 1000,
                operation: 'income',
                confirmed: true,
                account_id: 'acc-1',
                date: new Date()
            })
            await sut.create({
                amount: 300,
                operation: 'expense',
                confirmed: true,
                account_id: 'acc-1',
                date: new Date()
            })
            await sut.create({
                amount: 200,
                operation: 'income',
                confirmed: false,
                account_id: 'acc-1',
                date: new Date()
            })

            const summary = await sut.getFinancialSummary()

            expect(summary.totalBalance).toBe(700) // 1000 - 300
        })

        it('should separate monthly incomes and expenses correctly', async () => {
            const currentDate = new Date()

            // Current Month Income
            await sut.create({
                amount: 500,
                operation: 'income',
                confirmed: true,
                account_id: 'acc-1',
                date: currentDate
            })

            // Current Month Expense
            await sut.create({
                amount: 100,
                operation: 'expense',
                confirmed: true,
                account_id: 'acc-1',
                date: currentDate
            })

            // Last Month Income (Should be ignored for monthly metrics)
            const lastMonth = new Date(currentDate)
            lastMonth.setMonth(lastMonth.getMonth() - 1)
            await sut.create({
                amount: 1000,
                operation: 'income',
                confirmed: true,
                account_id: 'acc-1',
                date: lastMonth
            })

            const summary = await sut.getFinancialSummary()

            expect(summary.monthlyIncome).toBe(500)
            expect(summary.monthlyExpenses).toBe(100)
        })

        it('should calculate pending incomes and expenses for the current month', async () => {
            const currentDate = new Date()

            // Pending Income
            await sut.create({
                amount: 200,
                operation: 'income',
                confirmed: false,
                account_id: 'acc-1',
                date: currentDate
            })

            // Confirmed Income (Should not be in pending)
            await sut.create({
                amount: 300,
                operation: 'income',
                confirmed: true,
                account_id: 'acc-1',
                date: currentDate
            })

            // Pending Expense
            await sut.create({
                amount: 50,
                operation: 'expense',
                confirmed: false,
                account_id: 'acc-1',
                date: currentDate
            })

            const summary = await sut.getFinancialSummary()

            expect(summary.pendingIncome).toBe(200)
            expect(summary.pendingExpenses).toBe(50)
        })

        it('should identify overdue transactions correctly', async () => {
            const yesterday = new Date()
            yesterday.setDate(yesterday.getDate() - 5) // 5 days ago

            const tomorrow = new Date()
            tomorrow.setDate(tomorrow.getDate() + 5) // 5 days in future

            // Overdue Income (Pending and Date < Today)
            await sut.create({
                amount: 150,
                operation: 'income',
                confirmed: false,
                account_id: 'acc-1',
                date: yesterday
            })

            // Future Pending Income (Not overdue)
            await sut.create({
                amount: 200,
                operation: 'income',
                confirmed: false,
                account_id: 'acc-1',
                date: tomorrow
            })

            // Overdue Expense
            await sut.create({
                amount: 80,
                operation: 'expense',
                confirmed: false,
                account_id: 'acc-1',
                date: yesterday
            })

            const summary = await sut.getFinancialSummary()

            expect(summary.overdueIncome).toBe(150)
            expect(summary.overdueExpenses).toBe(80)
        })
    })

    describe('findMany', () => {
        it('should filter transactions by month', async () => {
            const january = new Date(2024, 0, 15) // Jan 15, 2024
            const february = new Date(2024, 1, 15) // Feb 15, 2024

            await sut.create({
                id: 'tx-jan',
                amount: 100,
                operation: 'income',
                confirmed: true,
                account_id: 'acc-1',
                date: january
            } as any)

            await sut.create({
                id: 'tx-feb',
                amount: 100,
                operation: 'income',
                confirmed: true,
                account_id: 'acc-1',
                date: february
            } as any)

            // Search for January 2024
            const resultJan = await sut.findMany(
                new Date(2024, 0, 1),
                1,
                20
            )

            expect(resultJan?.transactions).toHaveLength(1)
            expect(resultJan?.transactions[0].id).toBe('tx-jan')
        })
    })
})
