import { FastifyInstance } from 'fastify'


import { verifyJwt } from '@/http/middlewares/verify-jwt'
import { getMonthTreatmentsAmount } from '@/modules/metrics/http/controllers/getMonthTreatmentsAmount'
import { getMonthIncomeAmount } from '@/modules/metrics/http/controllers/getMonthIncomeAmount'
import { getMonthExpenseAmount } from '@/modules/metrics/http/controllers/getMonthExpenseAmount'
import { getMonthIncomeByDay } from '@/modules/metrics/http/controllers/getMonthIncomeByDay'
import { getMonthExpenseBySector } from '@/modules/metrics/http/controllers/getMonthExpenseBySector'
import { getGeneralBalance } from '@/modules/metrics/http/controllers/getGeneralBalance'
import { getBalanceProjection } from '@/modules/metrics/http/controllers/get-balance-projection'




export async function metricsRoutes(app: FastifyInstance) {
    app.addHook('onRequest', verifyJwt)
    app.get('/metrics/month-treatments-amount', getMonthTreatmentsAmount)
    app.get('/metrics/month-income-amount', getMonthIncomeAmount)
    app.get('/metrics/month-expense-amount', getMonthExpenseAmount)
    app.get('/metrics/month-income-by-days', getMonthIncomeByDay)
    app.get('/metrics/month-expense-by-sector', getMonthExpenseBySector)
    app.get('/metrics/general-balance', getGeneralBalance)
    app.get('/balance-projection', getBalanceProjection)
}
