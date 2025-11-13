// tests/get-financial-summary.spec.ts
import { expect, describe, it, beforeEach } from 'vitest'
import { GetFinancialSummaryUseCase } from '@/use-cases/get-financial-summary'
import { InMemoryTransactionsRepository } from '@/repositories/in-memory/in-memory-transactions-repository'

let transactionsRepository: InMemoryTransactionsRepository
let getFinancialSummaryUseCase: GetFinancialSummaryUseCase

describe('Get Financial Summary Use Case', () => {
    beforeEach(() => {
        transactionsRepository = new InMemoryTransactionsRepository()
        getFinancialSummaryUseCase = new GetFinancialSummaryUseCase(transactionsRepository)
    })

    it('should be able to get financial summary with correct calculations', async () => {
        // Criar transações de teste para o mês atual
        const currentDate = new Date()

        // Transações de entrada confirmadas
        await transactionsRepository.create({
            operation: 'income',
            amount: 1000,
            confirmed: true,
            date: currentDate,
            account_id: 'account-1'
        })

        await transactionsRepository.create({
            operation: 'income',
            amount: 500,
            confirmed: true,
            date: currentDate,
            account_id: 'account-1'
        })

        // Transações de saída confirmadas
        await transactionsRepository.create({
            operation: 'expense',
            amount: 300,
            confirmed: true,
            date: currentDate,
            account_id: 'account-1'
        })

        await transactionsRepository.create({
            operation: 'expense',
            amount: 200,
            confirmed: true,
            date: currentDate,
            account_id: 'account-1'
        })

        // Transações pendentes
        await transactionsRepository.create({
            operation: 'income',
            amount: 400,
            confirmed: false,
            date: currentDate,
            account_id: 'account-1'
        })

        await transactionsRepository.create({
            operation: 'expense',
            amount: 150,
            confirmed: false,
            date: currentDate,
            account_id: 'account-1'
        })

        const { summary } = await getFinancialSummaryUseCase.execute()

        expect(summary.totalBalance).toEqual(1000) // (1000 + 500) - (300 + 200) = 1000
        expect(summary.monthlyIncome).toEqual(1500) // 1000 + 500
        expect(summary.monthlyExpenses).toEqual(500) // 300 + 200
        expect(summary.pendingIncome).toEqual(400)
        expect(summary.pendingExpenses).toEqual(150)
    })

    it('should be able to get financial summary with no transactions', async () => {
        const { summary } = await getFinancialSummaryUseCase.execute()

        expect(summary.totalBalance).toEqual(0)
        expect(summary.monthlyIncome).toEqual(0)
        expect(summary.monthlyExpenses).toEqual(0)
        expect(summary.pendingIncome).toEqual(0)
        expect(summary.pendingExpenses).toEqual(0)
    })

    it('should be able to get financial summary with only income transactions', async () => {
        const currentDate = new Date()

        await transactionsRepository.create({
            operation: 'income',
            amount: 2000,
            confirmed: true,
            date: currentDate,
            account_id: 'account-1'
        })

        await transactionsRepository.create({
            operation: 'income',
            amount: 800,
            confirmed: false,
            date: currentDate,
            account_id: 'account-1'
        })

        const { summary } = await getFinancialSummaryUseCase.execute()

        expect(summary.totalBalance).toEqual(2000)
        expect(summary.monthlyIncome).toEqual(2000)
        expect(summary.monthlyExpenses).toEqual(0)
        expect(summary.pendingIncome).toEqual(800)
        expect(summary.pendingExpenses).toEqual(0)
    })

    it('should be able to get financial summary with only expense transactions', async () => {
        const currentDate = new Date()

        await transactionsRepository.create({
            operation: 'expense',
            amount: 1000,
            confirmed: true,
            date: currentDate,
            account_id: 'account-1'
        })

        await transactionsRepository.create({
            operation: 'expense',
            amount: 500,
            confirmed: false,
            date: currentDate,
            account_id: 'account-1'
        })

        const { summary } = await getFinancialSummaryUseCase.execute()

        expect(summary.totalBalance).toEqual(-1000)
        expect(summary.monthlyIncome).toEqual(0)
        expect(summary.monthlyExpenses).toEqual(1000)
        expect(summary.pendingIncome).toEqual(0)
        expect(summary.pendingExpenses).toEqual(500)
    })

    it('should correctly calculate balance with mixed confirmed transactions from different months', async () => {
        const currentDate = new Date()

        // Transações de meses anteriores para testar o saldo total
        const lastMonth = new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 15)

        await transactionsRepository.create({
            operation: 'income',
            amount: 5000,
            confirmed: true,
            date: lastMonth,
            account_id: 'account-1'
        })

        await transactionsRepository.create({
            operation: 'expense',
            amount: 2000,
            confirmed: true,
            date: lastMonth,
            account_id: 'account-1'
        })

        // Transações do mês atual
        await transactionsRepository.create({
            operation: 'income',
            amount: 3000,
            confirmed: true,
            date: currentDate,
            account_id: 'account-1'
        })

        await transactionsRepository.create({
            operation: 'expense',
            amount: 1000,
            confirmed: true,
            date: currentDate,
            account_id: 'account-1'
        })

        const { summary } = await getFinancialSummaryUseCase.execute()

        // Saldo total: (5000 + 3000) - (2000 + 1000) = 5000
        expect(summary.totalBalance).toEqual(5000)
        expect(summary.monthlyIncome).toEqual(3000) // Apenas do mês atual
        expect(summary.monthlyExpenses).toEqual(1000) // Apenas do mês atual
        expect(summary.pendingIncome).toEqual(0)
        expect(summary.pendingExpenses).toEqual(0)
    })

    it('should correctly handle only pending transactions', async () => {
        const currentDate = new Date()

        await transactionsRepository.create({
            operation: 'income',
            amount: 1000,
            confirmed: false,
            date: currentDate,
            account_id: 'account-1'
        })

        await transactionsRepository.create({
            operation: 'expense',
            amount: 500,
            confirmed: false,
            date: currentDate,
            account_id: 'account-1'
        })

        const { summary } = await getFinancialSummaryUseCase.execute()

        expect(summary.totalBalance).toEqual(0) // Nenhuma transação confirmada
        expect(summary.monthlyIncome).toEqual(0) // Nenhuma entrada confirmada
        expect(summary.monthlyExpenses).toEqual(0) // Nenhuma saída confirmada
        expect(summary.pendingIncome).toEqual(1000)
        expect(summary.pendingExpenses).toEqual(500)
    })

    it('should handle transactions with zero amounts', async () => {
        const currentDate = new Date()

        await transactionsRepository.create({
            operation: 'income',
            amount: 0,
            confirmed: true,
            date: currentDate,
            account_id: 'account-1'
        })

        await transactionsRepository.create({
            operation: 'expense',
            amount: 0,
            confirmed: false,
            date: currentDate,
            account_id: 'account-1'
        })

        const { summary } = await getFinancialSummaryUseCase.execute()

        expect(summary.totalBalance).toEqual(0)
        expect(summary.monthlyIncome).toEqual(0)
        expect(summary.monthlyExpenses).toEqual(0)
        expect(summary.pendingIncome).toEqual(0)
        expect(summary.pendingExpenses).toEqual(0)
    })
})