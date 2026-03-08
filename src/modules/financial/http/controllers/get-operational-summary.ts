import { FastifyRequest, FastifyReply } from 'fastify'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'

export async function getOperationalSummary(request: FastifyRequest, reply: FastifyReply) {
    const getSummaryQuerySchema = z.object({
        month: z.string().optional().transform(m => m ? Number(m) : new Date().getMonth() + 1),
        year: z.string().optional().transform(y => y ? Number(y) : new Date().getFullYear()),
    })

    const { month, year } = getSummaryQuerySchema.parse(request.query)

    try {
        const today = new Date()
        const startOfToday = new Date(today.getFullYear(), today.getMonth(), today.getDate())
        const fourteenDaysFromNow = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 14, 23, 59, 59, 999)

        // Limites do mês escolhido
        const firstDayOfMonth = new Date(year, month - 1, 1)
        const lastDayOfMonth = new Date(year, month, 0, 23, 59, 59, 999)

        // 1. Saldo Disponível (Soma total dos saldos atuais nas contas bancárias)
        const accountsAggr = await prisma.account.aggregate({
            _sum: { balance: true }
        })
        const saldoDisponivel = Number(accountsAggr._sum.balance || 0)

        // 2. Total Vencido Histórico (Contas a Pagar pendentes com data < hoje)
        const overdueExpensesAggr = await prisma.transaction.aggregate({
            _sum: { amount: true },
            where: {
                operation: 'expense',
                confirmed: false,
                data_vencimento: { lt: startOfToday },
            },
        })
        const totalVencido = Number(overdueExpensesAggr._sum.amount || 0)

        // 3. Projeção a Vencer em 14 dias (Despesas pendentes entre hoje e hoje + 14 dias)
        const upNextExpensesAggr = await prisma.transaction.aggregate({
            _sum: { amount: true },
            where: {
                operation: 'expense',
                confirmed: false,
                data_vencimento: {
                    gte: startOfToday,
                    lte: fourteenDaysFromNow
                },
            },
        })
        const projecao14Dias = Number(upNextExpensesAggr._sum.amount || 0)

        // 4. Receita Acumulada do Mês Escolhido e Ticket Médio (Receitas confirmadas dentro do mês)
        const currentMonthIncomeAggr = await prisma.transaction.aggregate({
            _sum: { amount: true },
            _count: { id: true },
            where: {
                operation: 'income',
                confirmed: true,
                data_vencimento: {
                    gte: firstDayOfMonth,
                    lte: lastDayOfMonth
                },
            },
        })
        const receitaAcumulada = Number(currentMonthIncomeAggr._sum.amount || 0)
        const numTransactions = currentMonthIncomeAggr._count.id || 0
        const ticketMedio = numTransactions > 0 ? receitaAcumulada / numTransactions : 0

        // 5. Agregações para o Ponto de Equilíbrio do Mês
        // 5.1 Total Despesas do Mês (Pago + A Pagar do Mês)
        const currentMonthTotalExpensesAggr = await prisma.transaction.aggregate({
            _sum: { amount: true },
            where: {
                operation: 'expense',
                data_vencimento: {
                    gte: firstDayOfMonth,
                    lte: lastDayOfMonth
                },
            },
        })
        const totalDespesasMes = Number(currentMonthTotalExpensesAggr._sum.amount || 0)

        // 5.2 Despesas Já Pagas do Mês
        const currentMonthPaidExpensesAggr = await prisma.transaction.aggregate({
            _sum: { amount: true },
            where: {
                operation: 'expense',
                confirmed: true,
                data_vencimento: {
                    gte: firstDayOfMonth,
                    lte: lastDayOfMonth
                },
            },
        })
        const despesasPagasMes = Number(currentMonthPaidExpensesAggr._sum.amount || 0)

        return reply.status(200).send({
            saldoDisponivel,
            totalVencido,
            projecao14Dias,
            receitaAcumulada,
            ticketMedio,
            totalDespesasMes,
            despesasPagasMes
        })
    } catch (err) {
        console.error('[getOperationalSummary] Error:', err)
        return reply.status(500).send({ message: 'Internal Server Error' })
    }
}
