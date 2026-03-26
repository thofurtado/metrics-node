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
        // Datas base no fuso Brasil (evitar deslocamento UTC)
        const nowStr = new Date().toLocaleString("en-US", { timeZone: "America/Sao_Paulo" })
        const localNow = new Date(nowStr)

        // Início do dia atual (00:00:00)
        const startOfToday = new Date(localNow)
        startOfToday.setHours(0, 0, 0, 0)

        // Fim do dia atual (23:59:59)
        const endOfToday = new Date(localNow)
        endOfToday.setHours(23, 59, 59, 999)

        // Daqui a 14 dias (incluindo o dia final)
        const fourteenDaysFromNow = new Date(localNow)
        fourteenDaysFromNow.setDate(localNow.getDate() + 14)
        fourteenDaysFromNow.setHours(23, 59, 59, 999)

        // Primeiro e último dia do mês filtrado
        const firstDayOfMonth = new Date(year, month - 1, 1, 0, 0, 0, 0)
        const lastDayOfMonth = new Date(year, month, 0, 23, 59, 59, 999)

        // ─────────────────────────────────────────────────────────────────
        // 1. SALDO DISPONÍVEL — soma de TODAS as contas (positivo e negativo)
        // ─────────────────────────────────────────────────────────────────
        const accountsAggr = await prisma.account.aggregate({
            _sum: { balance: true }
        })
        const saldoDisponivel = Number(accountsAggr._sum.balance || 0)

        // ─────────────────────────────────────────────────────────────────
        // 2. TOTAL VENCIDO — despesas NÃO pagas com data_vencimento < hoje
        // ─────────────────────────────────────────────────────────────────
        const overdueAggr = await prisma.transaction.aggregate({
            _sum: { amount: true },
            where: {
                operation: 'expense',
                confirmed: false,
                data_vencimento: { lt: startOfToday },
            },
        })
        const totalVencido = Number(overdueAggr._sum.amount || 0)

        // ─────────────────────────────────────────────────────────────────
        // 3. PROJEÇÃO 14 DIAS — despesas NÃO pagas de hoje até hoje+14
        // ─────────────────────────────────────────────────────────────────
        const projecaoAggr = await prisma.transaction.aggregate({
            _sum: { amount: true },
            where: {
                operation: 'expense',
                confirmed: false,
                data_vencimento: { gte: startOfToday, lte: fourteenDaysFromNow },
            },
        })
        const projecao14Dias = Number(projecaoAggr._sum.amount || 0)

        // ─────────────────────────────────────────────────────────────────
        // 4. RECEITA ACUMULADA — recebimentos CONFIRMADOS do dia 1 até HOJE
        //    numEntradas  = quantidade de recebimentos confirmados até hoje
        //    ticketMedio  = receitaAcumulada / numEntradas
        // ─────────────────────────────────────────────────────────────────
        const paidIncomeAggr = await prisma.transaction.aggregate({
            _sum: { totalValue: true },
            _count: { id: true },
            where: {
                operation: 'income',
                confirmed: true,
                data_vencimento: { gte: firstDayOfMonth, lte: endOfToday },
            },
        })
        const receitaAcumulada = Number(paidIncomeAggr._sum.totalValue || 0)
        const numEntradas = paidIncomeAggr._count.id || 0
        const ticketMedio = numEntradas > 0 ? receitaAcumulada / numEntradas : 0

        // ─────────────────────────────────────────────────────────────────
        // 5. DESPESAS DO MÊS
        //    totalDespesasMes = pendentes (amount) + pagas (totalValue) do mês
        //    despesasPagasMes = valor efetivo das despesas pagas no mês
        //    totalJurosPagos  = soma dos juros das despesas pagas no mês
        // ─────────────────────────────────────────────────────────────────

        // Despesas PENDENTES do mês — usa o valor de face (amount)
        const pendingExpensesAggr = await prisma.transaction.aggregate({
            _sum: { amount: true },
            where: {
                operation: 'expense',
                confirmed: false,
                data_vencimento: { gte: firstDayOfMonth, lte: lastDayOfMonth },
            },
        })
        const pendingExpensesMes = Number(pendingExpensesAggr._sum.amount || 0)

        // Despesas PAGAS do mês — usa totalValue (pode incluir juros) + coleta interest
        const paidExpensesAggr = await prisma.transaction.aggregate({
            _sum: { totalValue: true, interest: true },
            where: {
                operation: 'expense',
                confirmed: true,
                data_vencimento: { gte: firstDayOfMonth, lte: lastDayOfMonth },
            },
        })
        const despesasPagasMes = Number(paidExpensesAggr._sum.totalValue || 0)
        const totalJurosPagos = Number(paidExpensesAggr._sum.interest || 0)

        // Total = pagas + pendentes
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
