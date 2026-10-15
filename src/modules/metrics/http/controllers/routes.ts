import { FastifyInstance } from 'fastify'


import { verifyJwt } from '@/http/middlewares/verify-jwt'
import { verifyModuleAccess } from '@/http/middlewares/verify-module-access'
import { getMonthTreatmentsAmount } from '@/modules/metrics/http/controllers/getMonthTreatmentsAmount'
import { getMonthIncomeAmount } from '@/modules/metrics/http/controllers/getMonthIncomeAmount'
import { getMonthExpenseAmount } from '@/modules/metrics/http/controllers/getMonthExpenseAmount'
import { getMonthIncomeByDay } from '@/modules/metrics/http/controllers/getMonthIncomeByDay'
import { getMonthExpenseBySector } from '@/modules/metrics/http/controllers/getMonthExpenseBySector'
import { getGeneralBalance } from '@/modules/metrics/http/controllers/getGeneralBalance'
import { getBalanceProjection } from '@/modules/metrics/http/controllers/get-balance-projection'




// Fase 0 do Mergulho (17:U1): números do painel. Os do dinheiro exigem o Financeiro; o de O.S., o Atendimento.
const travaFinanceiro = verifyModuleAccess('finance')
const travaAtendimento = verifyModuleAccess('service')

export async function metricsRoutes(app: FastifyInstance) {
    app.addHook('onRequest', verifyJwt)
    app.addHook('onRequest', async (request, reply) => {
        if (request.routeOptions.url === '/metrics/month-treatments-amount') return travaAtendimento(request, reply)
        return travaFinanceiro(request, reply)
    })
    app.get('/metrics/month-treatments-amount', getMonthTreatmentsAmount)
    app.get('/metrics/month-income-amount', getMonthIncomeAmount)
    app.get('/metrics/month-expense-amount', getMonthExpenseAmount)
    app.get('/metrics/month-income-by-days', getMonthIncomeByDay)
    app.get('/metrics/month-expense-by-sector', getMonthExpenseBySector)
    app.get('/metrics/general-balance', getGeneralBalance)
    app.get('/balance-projection', getBalanceProjection)
}
