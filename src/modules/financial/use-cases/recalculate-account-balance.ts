import { AccountsRepository } from '@/modules/financial/repositories/accounts-repository'
import { ResourceNotFoundError } from '@/errors/resource-not-found-error'
import { prisma } from '@/lib/prisma'

interface RecalculateAccountBalanceUseCaseRequest {
    id: string
}

export class RecalculateAccountBalanceUseCase {
    constructor(private accountsRepository: AccountsRepository) { }

    async execute({ id }: RecalculateAccountBalanceUseCaseRequest) {
        return await prisma.$transaction(async (tx) => {
            const account = await tx.account.findUnique({
                where: { id }
            })

            if (!account) {
                throw new ResourceNotFoundError()
            }

            // Sum of all confirmed incomes
            const totalIncome = await tx.transaction.aggregate({
                where: {
                    account_id: id,
                    operation: 'income',
                    confirmed: true
                },
                _sum: {
                    totalValue: true,
                    amount: true
                }
            })

            // Sum of all confirmed expenses
            const totalExpense = await tx.transaction.aggregate({
                where: {
                    account_id: id,
                    operation: 'expense',
                    confirmed: true
                },
                _sum: {
                    totalValue: true,
                    amount: true
                }
            })

            const incomeSum = totalIncome._sum.totalValue ?? totalIncome._sum.amount ?? 0
            const expenseSum = totalExpense._sum.totalValue ?? totalExpense._sum.amount ?? 0

            const newBalance = incomeSum - expenseSum

            // Registrar o ajuste de saldo no banco de dados para rastreabilidade
            await tx.accountAdjustment.create({
                data: {
                    account_id: id,
                    previous_balance: account.balance,
                    new_balance: newBalance,
                    description: 'Recálculo Automático de Saldo (Soma de Transações Confirmadas)'
                }
            })

            // Atualizar o saldo da conta
            const updatedAccount = await tx.account.update({
                where: { id },
                data: {
                    balance: newBalance
                }
            })

            return { account: updatedAccount }
        })
    }
}
