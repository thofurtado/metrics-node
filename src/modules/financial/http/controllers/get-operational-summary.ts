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
        // Garante que o UTC-0300 não desloque a data para amanhã, e mantém no início/fim exatos do dia local do Brasil
        const nowStr = new Date().toLocaleString("en-US", { timeZone: "America/Sao_Paulo" });
        const localNow = new Date(nowStr);

        const startOfToday = new Date(localNow);
        startOfToday.setHours(0, 0, 0, 0);

        const fourteenDaysFromNow = new Date(localNow);
        fourteenDaysFromNow.setDate(localNow.getDate() + 14);
        fourteenDaysFromNow.setHours(23, 59, 59, 999);

        // Limites do mês escolhido (base no mês local também)
        const firstDayOfMonth = new Date(year, month - 1, 1, 0, 0, 0, 0);
        const lastDayOfMonth = new Date(year, month, 0, 23, 59, 59, 999);

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

        // 4. Receita Acumulada do Mês Escolhido e Ticket Médio (Todas as receitas, pagas ou não)
        const currentMonthPendingIncomeAggr = await prisma.transaction.aggregate({
            _sum: { amount: true },
            _count: { id: true },
            where: {
                operation: 'income',
                confirmed: false,
                data_vencimento: { gte: firstDayOfMonth, lte: lastDayOfMonth },
            },
        })
        const currentMonthPaidIncomeAggr = await prisma.transaction.aggregate({
            _sum: { totalValue: true },
            _count: { id: true },
            where: {
                operation: 'income',
                confirmed: true,
                data_vencimento: { gte: firstDayOfMonth, lte: lastDayOfMonth },
            },
        })

        const pendingIncome = Number(currentMonthPendingIncomeAggr._sum.amount || 0)
        const paidIncome = Number(currentMonthPaidIncomeAggr._sum.totalValue || 0)
        const receitaAcumulada = pendingIncome + paidIncome

        const numEntradasPending = currentMonthPendingIncomeAggr._count.id || 0
        const numEntradasPaid = currentMonthPaidIncomeAggr._count.id || 0
        const numEntradas = numEntradasPending + numEntradasPaid

        const ticketMedio = numEntradas > 0 ? receitaAcumulada / numEntradas : 0

        // 5. Agregações para o Ponto de Equilíbrio do Mês
        // 5.1 Despesas A Pagar do Mês
        const currentMonthPendingExpensesAggr = await prisma.transaction.aggregate({
            _sum: { amount: true },
            where: {
                operation: 'expense',
                confirmed: false,
                data_vencimento: { gte: firstDayOfMonth, lte: lastDayOfMonth },
            },
        })
        const pendingExpensesMes = Number(currentMonthPendingExpensesAggr._sum.amount || 0)

        // 5.2 Despesas Já Pagas do Mês
        const currentMonthPaidExpensesAggr = await prisma.transaction.aggregate({
            _sum: { totalValue: true, interest: true },
            where: {
                operation: 'expense',
                confirmed: true,
                data_vencimento: { gte: firstDayOfMonth, lte: lastDayOfMonth },
            },
        })
        const despesasPagasMes = Number(currentMonthPaidExpensesAggr._sum.totalValue || 0)
        const totalJurosPagos = Number(currentMonthPaidExpensesAggr._sum.interest || 0)

        // 5.3 Total Despesas do Mês (Pago + A Pagar)
        const totalDespesasMes = despesasPagasMes + pendingExpensesMes

        return reply.status(200).send({
            saldoDisponivel,
            totalVencido,
            projecao14Dias,
            receitaAcumulada,
            ticketMedio,
            numEntradas,
            totalDespesasMes,
            despesasPagasMes,
            totalJurosPagos
        })
    } catch (err) {
        console.error('[getOperationalSummary] Error:', err)
        return reply.status(500).send({ message: 'Internal Server Error' })
    }
}
