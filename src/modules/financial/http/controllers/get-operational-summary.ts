import { FastifyRequest, FastifyReply } from 'fastify'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'

export async function getOperationalSummary(request: FastifyRequest, reply: FastifyReply) {
    const getSummaryQuerySchema = z.object({
        month: z.string().optional().transform(m => m ? Number(m) : new Date().getMonth() + 1),
        year: z.string().optional().transform(y => y ? Number(y) : new Date().getFullYear()),
        projectionDays: z.string().optional().transform(p => p ? Number(p) : 14),
    })

    const { month, year, projectionDays } = getSummaryQuerySchema.parse(request.query)

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

        // Daqui a X dias (incluindo o dia final)
        const targetDaysFromNow = new Date(localNow)
        targetDaysFromNow.setDate(localNow.getDate() + projectionDays)
        targetDaysFromNow.setHours(23, 59, 59, 999)

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
        // 3. PROJEÇÃO DE X DIAS — despesas NÃO pagas de hoje até hoje+X
        // ─────────────────────────────────────────────────────────────────
        const projecaoAggr = await prisma.transaction.aggregate({
            _sum: { amount: true },
            where: {
                operation: 'expense',
                confirmed: false,
                data_vencimento: { gte: startOfToday, lte: targetDaysFromNow },
            },
        })
        const projecaoDinheiro = Number(projecaoAggr._sum.amount || 0)

        // ─────────────────────────────────────────────────────────────────
        // 4. TICKET MÉDIO E NÚMERO DE ENTRADAS — Via Repositório de Caixa
        // ─────────────────────────────────────────────────────────────────
        
        // Entradas Históricas Totais (Avulsas + Caixas)
        // 1. Avulsas
        const allTimePaidIncomeNonSessionAggr = await prisma.transaction.aggregate({
            _count: { id: true },
            where: { operation: 'income', confirmed: true, cashier_session_id: null },
        })
        const numEntradasHistoricaNonSession = allTimePaidIncomeNonSessionAggr._count.id || 0

        // 2. Caixas Fechados (Sessões)
        const closedSessionsCount = await prisma.cashierSession.count({
            where: { status: { not: 'OPEN' } }
        })
        const numEntradasHistoricaSessions = closedSessionsCount
        const numEntradasHistorica = numEntradasHistoricaNonSession + numEntradasHistoricaSessions

        // Receita Bruta Histórica (para Ticket Médio)
        // 1. Avulsas (do financeiro)
        const allTimeRevenueNonSessionAggr = await prisma.transaction.aggregate({
            _sum: { totalValue: true },
            where: { operation: 'income', confirmed: true, cashier_session_id: null }
        })
        const totalReceitaHistoricaNonSession = Number(allTimeRevenueNonSessionAggr._sum.totalValue || 0)

        // 2. Caixas Fechados (do Repositório de Caixa - valor de face das vendas)
        const cashierEntriesAggr = await prisma.cashierEntry.aggregate({
            _sum: { amount: true },
            where: {
                type: 'SALE',
                is_withdrawal: false,
                session: { status: { not: 'OPEN' } }
            }
        })
        const totalReceitaHistoricaSessions = Number(cashierEntriesAggr._sum.amount || 0)
        
        const totalReceitaHistorica = totalReceitaHistoricaNonSession + totalReceitaHistoricaSessions
        const ticketMedio = numEntradasHistorica > 0 ? totalReceitaHistorica / numEntradasHistorica : 0

        // Número de Entradas do Mês atual (para exibir no Dashboard)
        const monthNonSessionAggr = await prisma.transaction.aggregate({
            _count: { id: true },
            where: {
                operation: 'income', confirmed: true, cashier_session_id: null,
                data_vencimento: { gte: firstDayOfMonth, lte: lastDayOfMonth }
            }
        })
        const monthClosedSessionsCount = await prisma.cashierSession.count({
            where: { 
                status: { not: 'OPEN' },
                opened_at: { gte: firstDayOfMonth, lte: lastDayOfMonth }
            }
        })
        const numEntradas = (monthNonSessionAggr._count.id || 0) + monthClosedSessionsCount

        // ─────────────────────────────────────────────────────────────────
        // 5. RECEITAS FINANCEIRAS DO MÊS — Pagas + Não Pagas
        // ─────────────────────────────────────────────────────────────────
        // Aqui mantemos a leitura da tabela Transaction, pois reflete o que 
        // efetivamente entra/entrou de dinheiro/cartão/fiado pago no banco.
        
        const paidIncomeMonthAggr = await prisma.transaction.aggregate({
            _sum: { totalValue: true },
            where: {
                operation: 'income',
                confirmed: true,
                data_vencimento: { gte: firstDayOfMonth, lte: lastDayOfMonth },
            },
        })
        const receitaPagaMes = Number(paidIncomeMonthAggr._sum.totalValue || 0)

        const pendingIncomeMonthAggr = await prisma.transaction.aggregate({
            _sum: { amount: true },
            where: {
                operation: 'income',
                confirmed: false,
                data_vencimento: { gte: firstDayOfMonth, lte: lastDayOfMonth },
            },
        })
        const receitaPendenteMes = Number(pendingIncomeMonthAggr._sum.amount || 0)

        const totalReceitasMes = receitaPagaMes + receitaPendenteMes
        const receitaAcumulada = receitaPagaMes // Mantém retrocompatibilidade

        // ─────────────────────────────────────────────────────────────────
        // 6. DESPESAS DO MÊS
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

        // ─────────────────────────────────────────────────────────────────
        // 7. BALANÇO MENSAL
        // ─────────────────────────────────────────────────────────────────
        const balancoMensal = totalReceitasMes - totalDespesasMes

        return reply.status(200).send({
            saldoDisponivel,
            totalVencido,
            projecaoDinheiro,
            projecao14Dias: projecaoDinheiro, // Mantém p/ retrocompatibilidade
            totalReceitasMes,
            receitaAcumulada,
            ticketMedio,
            numEntradas,
            totalDespesasMes,
            despesasPagasMes,
            totalJurosPagos,
            balancoMensal
        })
    } catch (err) {
        console.error('[getOperationalSummary] Error:', err)
        return reply.status(500).send({ message: 'Internal Server Error' })
    }
}
