import { Prisma, Transaction } from '@prisma/client'
import { GetTransactionsDTO } from '@/modules/financial/repositories/DTO/get-transactions-dto'
import { ChangeTransactionStatusParams } from '@/modules/financial/repositories/DTO/change-transaction-status-params-dto'

export interface TransactionsRepository {
    create(data: Prisma.TransactionUncheckedCreateInput, tx?: Prisma.TransactionClient): Promise<Transaction>
    update(data: Prisma.TransactionUncheckedUpdateInput): Promise<Transaction> // Atualizado: recebe o ID e os dados para atualização
    changeTransactionStatus(data: ChangeTransactionStatusParams): Promise<void>
    revertTransactionStatus(id: string): Promise<void>
    findMany(month: Date, pageIndex?: number, perPage?: number, description?: string, value?: number, sector_id?: string, account_id?: string, status?: string, toDate?: Date, supplier_id?: string, operation?: string, fromDate?: Date, sortBy?: string, sortDirection?: string): Promise<GetTransactionsDTO | null>
    findById(id: string): Promise<Transaction | null>
    delete(id: string): Promise<void>
    getBalance(): Promise<number>
    getMonthExpenseAmount(date?: Date): Promise<{ monthExpenseAmount: number, diffFromLastMonth: number, alreadyPaid: number }>
    getMonthIncomeAmount(date?: Date): Promise<{ monthIncomeAmount: number, diffFromLastMonth: number, alreadyPaid: number }>
    getMonthIncomeByDays(date?: Date): Promise<{ day: string; revenue: number; }[]>
    getMonthExpenseBySector(date?: Date): Promise<{ sector_name: string; amount: number; }[]>
    getFinancialSummary(date?: Date): Promise<{
        totalBalance: number;
        monthlyIncome: number;
        monthlyExpenses: number;
        pendingIncome: number;
        pendingExpenses: number;
        overdueIncome: number;
        overdueExpenses: number;
    }>
    markAsPaidMany(ids: string[]): Promise<void>
}