import { FastifyInstance } from 'fastify'
import { 
    openCashierSession, 
    getActiveSession, 
    addCashierEntry, 
    deleteCashierEntry, 
    updateCashierEntry, 
    closeCashierSession, 
    auditCashierSession, 
    getMonthlyCashAudit,
    getPaymentMethodsConfig, 
    getPaymentConditionsConfig, 
    getPOSMachinesConfig, 
    getSessions, 
    deleteSession, 
    getSessionDetails, 
    getCashierUsers,
    getCashierEmployees,
    getPOSMachines,
    createPOSMachine,
    updatePOSMachine,
    deletePOSMachine,
    getPaymentIdentifiers,
    createPaymentIdentifier,
    updatePaymentIdentifier,
    deletePaymentIdentifier
} from './cashier-controller'
import { verifyJwt } from '@/http/middlewares/verify-jwt'

export async function cashierRoutes(app: FastifyInstance) {
    // Rota pública para buscar operadores de caixa (ADMIN ou CASHIER) sem estar logado
    app.get('/api/cashier/users', getCashierUsers)
    app.get('/api/cashier/employees', getCashierEmployees)

    // Rotas protegidas por JWT
    app.register(async (protectedApp) => {
        protectedApp.addHook('onRequest', verifyJwt)

        protectedApp.get('/api/cashier/sessions', getSessions)
        protectedApp.get('/api/cashier/monthly-audit', getMonthlyCashAudit)
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

        // POS Machines Management
        protectedApp.get('/api/pos-machines', getPOSMachines)
        protectedApp.post('/api/pos-machines', createPOSMachine)
        protectedApp.put('/api/pos-machines/:id', updatePOSMachine)
        protectedApp.delete('/api/pos-machines/:id', deletePOSMachine)

        // Payment Identifiers Management
        protectedApp.get('/api/payment-identifiers', getPaymentIdentifiers)
        protectedApp.post('/api/payment-identifiers', createPaymentIdentifier)
        protectedApp.put('/api/payment-identifiers/:id', updatePaymentIdentifier)
        protectedApp.delete('/api/payment-identifiers/:id', deletePaymentIdentifier)
    })
}
