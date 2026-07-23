import { FastifyInstance } from 'fastify'
import { openCashierSession, getActiveSession, addCashierEntry, closeCashierSession, auditCashierSession, getPaymentMethodsConfig, getPaymentConditionsConfig, getPOSMachinesConfig, getSessions, deleteSession, getSessionDetails } from './cashier-controller'
import { verifyJwt } from '@/http/middlewares/verify-jwt'

export async function cashierRoutes(app: FastifyInstance) {
    app.addHook('onRequest', verifyJwt)

    app.get('/api/cashier/sessions', getSessions)
    app.get('/api/cashier/session/:id', getSessionDetails)
    app.delete('/api/cashier/sessions/:id', deleteSession)
    
    app.post('/api/cashier/session/open', openCashierSession)
    app.get('/api/cashier/session/active', getActiveSession)
    app.post('/api/cashier/session/close', closeCashierSession)
    app.post('/api/cashier/session/audit', auditCashierSession)
    app.post('/api/cashier/entry', addCashierEntry)
    
    app.get('/api/payment-methods', getPaymentMethodsConfig)
    app.get('/api/conditions', getPaymentConditionsConfig)
    app.get('/api/machines', getPOSMachinesConfig)
}
