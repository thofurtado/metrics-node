import { FastifyReply, FastifyRequest } from 'fastify'
import { z } from 'zod'
import { getPrismaForDomain } from '@/lib/tenant-manager'

export async function getMonthlySummary(request: FastifyRequest, reply: FastifyReply) {
  const querySchema = z.object({
    month: z.string().optional(),
  })

  const { month } = querySchema.parse(request.query)

  const domain = request.headers['x-tenant-domain'] as string
  if (!domain) {
    return reply.status(400).send({ message: 'x-tenant-domain header is required' })
  }

  const prisma = await getPrismaForDomain(domain)
  if (!prisma) {
    return reply.status(404).send({ message: 'Tenant not found or inactive' })
  }

  const targetDate = month ? new Date(month) : new Date()
  const startDate = new Date(targetDate.getFullYear(), targetDate.getMonth(), 1)
  const endDate = new Date(targetDate.getFullYear(), targetDate.getMonth() + 1, 0, 23, 59, 59, 999)

  const transactions = await prisma.transaction.findMany({
    where: {
      data_vencimento: {
        gte: startDate,
        lte: endDate
      }
    },
    include: {
      sectors: true
    }
  })

  let totalRevenue = 0
  let countRevenue = 0
  let totalExpenses = 0
  let countExpenses = 0
  let totalInterest = 0
  let totalPaid = 0
  let totalOpen = 0
  let expensesByCategoryMap = new Map<string, number>()

  let distinctCashierSessions = new Set<string>()
  let transactionsWithoutCashierSession = 0

  transactions.forEach(t => {
    // We only consider INCOME and EXPENSE for this summary (ignoring TRANSFERS for PnL usually)
    const op = t.operation?.toLowerCase()
    if (op === 'income' || op === 'receita') {
      totalRevenue += t.amount
      
      if (t.cashier_session_id) {
        distinctCashierSessions.add(t.cashier_session_id)
      } else {
        transactionsWithoutCashierSession++
      }
      if (t.confirmed) totalPaid += t.amount
      else totalOpen += t.amount
    } else if (op === 'expense' || op === 'despesa') {
      totalExpenses += t.amount
      countExpenses++
      if (t.confirmed) totalPaid -= t.amount 
      else totalOpen -= t.amount
      
      if (t.interest) {
        totalInterest += t.interest
      }

      const sectorName = t.sectors?.name || 'Sem Setor'
      const currentSectorTotal = expensesByCategoryMap.get(sectorName) || 0
      expensesByCategoryMap.set(sectorName, currentSectorTotal + t.amount)
    }
  })

  // Recalculate status totals specifically
  const incomePaid = transactions.filter(t => (t.operation?.toLowerCase() === 'income' || t.operation?.toLowerCase() === 'receita') && t.confirmed).reduce((acc, t) => acc + t.amount, 0)
  const incomeOpen = transactions.filter(t => (t.operation?.toLowerCase() === 'income' || t.operation?.toLowerCase() === 'receita') && !t.confirmed).reduce((acc, t) => acc + t.amount, 0)
  const expensePaid = transactions.filter(t => (t.operation?.toLowerCase() === 'expense' || t.operation?.toLowerCase() === 'despesa') && t.confirmed).reduce((acc, t) => acc + t.amount, 0)
  const expenseOpen = transactions.filter(t => (t.operation?.toLowerCase() === 'expense' || t.operation?.toLowerCase() === 'despesa') && !t.confirmed).reduce((acc, t) => acc + t.amount, 0)

  countRevenue = distinctCashierSessions.size + transactionsWithoutCashierSession

  const averageTicket = countRevenue > 0 ? totalRevenue / countRevenue : 0

  const expensesByCategory = Array.from(expensesByCategoryMap.entries())
    .map(([category, amount]) => ({ category, amount }))
    .sort((a, b) => b.amount - a.amount)

  return reply.send({
    revenue: {
      total: totalRevenue,
      count: countRevenue,
      averageTicket,
      paid: incomePaid,
      open: incomeOpen
    },
    expenses: {
      total: totalExpenses,
      count: countExpenses,
      interestPaid: totalInterest,
      paid: expensePaid,
      open: expenseOpen
    },
    balance: totalRevenue - totalExpenses,
    expensesByCategory
  })
}
