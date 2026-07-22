import { AccountsRepository } from '@/modules/financial/repositories/accounts-repository'
import { ResourceNotFoundError } from '@/errors/resource-not-found-error'
import { prisma } from '@/lib/prisma'

interface GetAccountHistoryUseCaseRequest {
    accountId: string
    page?: number
    limit?: number
}

export class GetAccountHistoryUseCase {
    constructor(private accountsRepository: AccountsRepository) {}

    async execute({ accountId, page = 1, limit = 20 }: GetAccountHistoryUseCaseRequest) {
        const account = await prisma.account.findUnique({
            where: { id: accountId }
        })

        if (!account) {
            throw new ResourceNotFoundError()
        }

        const skip = (page - 1) * limit

        // Obter transações confirmadas que afetaram o saldo
        const transactions = await prisma.transaction.findMany({
            where: {
                account_id: accountId,
                confirmed: true
            },
            select: {
                id: true,
                description: true,
                amount: true,
                totalValue: true,
                operation: true,
                data_emissao: true,
                data_vencimento: true,
                created_at: true
            }
        })

        // Obter ajustes manuais de saldo
        const adjustments = await prisma.accountAdjustment.findMany({
            where: { account_id: accountId }
        })

        // Combinar os dois e ordenar por data
        const history = [
            ...transactions.map(t => ({
                id: t.id,
                type: 'transaction',
                description: t.description,
                operation: t.operation, // 'income' ou 'expense'
                value: t.totalValue ?? t.amount,
                date: t.data_vencimento, // Usamos data_vencimento como momento do impacto pois ele é atualizado no ato da confirmação
                created_at: t.created_at
            })),
            ...adjustments.map(a => ({
                id: a.id,
                type: 'adjustment',
                description: a.description || 'Ajuste de Saldo',
                operation: a.new_balance > a.previous_balance ? 'income' : 'expense',
                value: Math.abs(a.new_balance - a.previous_balance),
                previous_balance: a.previous_balance,
                new_balance: a.new_balance,
                date: a.created_at,
                created_at: a.created_at
            }))
        ]

        // Ordenar do mais recente para o mais antigo
        history.sort((a, b) => b.date.getTime() - a.date.getTime())

        // Paginação manual
        const paginatedHistory = history.slice(skip, skip + limit)

        return {
            account: {
                id: account.id,
                name: account.name,
                balance: account.balance
            },
            history: paginatedHistory,
            totalCount: history.length,
            totalPages: Math.ceil(history.length / limit),
            currentPage: page
        }
    }
}
