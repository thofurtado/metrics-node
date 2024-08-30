import { FastifyInstance } from 'fastify'


import { verifyJWT } from '@/http/middlewares/verify-jwt'
import { getMonthTreatmentsAmount } from './getMonthTreatmentsAmount'
import { getMonthIncomeAmount } from './getMonthIncomeAmount'
import { getMonthExpenseAmount } from './getMonthExpenseAmount'
import { getMonthIncomeByDay } from './getMonthIncomeByDay'
import { getMonthExpenseBySector } from './getMonthExpenseBySector'
import { getGeneralBalance } from './getGeneralBalance'




export async function metricsRoutes(app: FastifyInstance) {
    app.addHook('onRequest', verifyJWT)
    app.get('/metrics/month-treatments-amount', getMonthTreatmentsAmount)
    app.get('/metrics/month-income-amount', getMonthIncomeAmount)
    app.get('/metrics/month-expense-amount', getMonthExpenseAmount)
    app.get('/metrics/month-income-by-days', getMonthIncomeByDay)
    app.get('/metrics/month-expense-by-sector', getMonthExpenseBySector)
    app.get('/metrics/general-balance', getGeneralBalance)
}
