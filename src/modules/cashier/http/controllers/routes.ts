import { FastifyInstance } from 'fastify'
import { openCashierSession, getActiveSession, addCashierEntry, deleteCashierEntry, updateCashierEntry, closeCashierSession, auditCashierSession, getPaymentMethodsConfig, getPaymentConditionsConfig, getPOSMachinesConfig, getSessions, deleteSession, getSessionDetails, getCashierUsers } from './cashier-controller'
import { verifyJwt } from '@/http/middlewares/verify-jwt'

export async function cashierRoutes(app: FastifyInstance) {
    // Rota pública para buscar operadores de caixa (ADMIN ou CASHIER) sem estar logado
    app.get('/api/cashier/users', getCashierUsers)

    // Rotas protegidas por JWT
    app.register(async (protectedApp) => {
        protectedApp.addHook('onRequest', verifyJwt)

        protectedApp.get('/api/cashier/sessions', getSessions)
        protectedApp.get('/api/cashier/session/:id', getSessionDetails)
        protectedApp.delete('/api/cashier/sessions/:id', deleteSession)
        
        protectedApp.post('/api/cashier/session/open', openCashierSession)
        protectedApp.get('/api/cashier/session/active', getActiveSession)
        protectedApp.post('/api/cashier/session/close', closeCashierSession)
        protectedApp.post('/api/cashier/session/audit', auditCashierSession)
        protectedApp.post('/api/cashier/entry', addCashierEntry)
        protectedApp.delete('/api/cashier/entry/:id', deleteCashierEntry)
        protectedApp.put('/api/cashier/entry/:id', updateCashierEntry)
        
        protectedApp.get('/api/payment-methods', getPaymentMethodsConfig)
        protectedApp.get('/api/conditions', getPaymentConditionsConfig)
        protectedApp.get('/api/machines', getPOSMachinesConfig)
    })
}
