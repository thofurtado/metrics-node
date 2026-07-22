import { FastifyInstance } from 'fastify'
import { openCashierSession, getActiveSession, addCashierEntry, closeCashierSession, auditCashierSession } from './cashier-controller'
import { verifyJwt } from '@/http/middlewares/verify-jwt'

export async function cashierRoutes(app: FastifyInstance) {
    app.addHook('onRequest', verifyJwt)

    app.post('/api/cashier/session/open', openCashierSession)
    app.get('/api/cashier/session/active', getActiveSession)
    app.post('/api/cashier/session/close', closeCashierSession)
    app.post('/api/cashier/session/audit', auditCashierSession)
    app.post('/api/cashier/entry', addCashierEntry)
}
