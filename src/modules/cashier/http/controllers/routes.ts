import { deleteOnlineOrder } from './delete-online-order'
import { FastifyInstance } from 'fastify'
import { 
    openCashierSession, 
    getActiveSession, 
    addCashierEntry, 
    deleteCashierEntry, 
    updateCashierEntry, 
    closeCashierSession, 
    submitCashierForReview,
    auditCashierSession, 
    revertCashierAudit,
    getMonthlyCashAudit,
    resolveCashierDivergence,
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
    deletePaymentIdentifier,
    updateCashierSessionBalance
} from './cashier-controller'
import { verifyJwt } from '@/http/middlewares/verify-jwt'
import { verifyModuleAccess } from '@/http/middlewares/verify-module-access'

// Fase 0 do Mergulho (17:U1): as sessões e lançamentos do caixa (/api/cashier/...) exigem o Caixa (papel CASHIER ou
// ADMIN) ou o Financeiro (a tela de Transações abre o lote do caixa). As listas de configuração (formas, condições,
// maquininhas, identificadores) ficam como estão: a tela do Caixa e as Configurações leem.
const travaCaixa = verifyModuleAccess('cashier', 'finance')

export async function cashierRoutes(app: FastifyInstance) {
    // Rota pública para buscar operadores de caixa (ADMIN ou CASHIER) sem estar logado (só id, nome e papel)
    app.get('/api/cashier/users', getCashierUsers)

    // Rotas protegidas por JWT
    app.register(async (protectedApp) => {
        protectedApp.addHook('onRequest', verifyJwt)
        protectedApp.addHook('onRequest', async (request, reply) => {
            if ((request.routeOptions.url || '').startsWith('/api/cashier/')) return travaCaixa(request, reply)
        })

        // Fase 4 do Mergulho (14:X8): a lista de funcionários era aberta sem login; só é usada no lançamento, já logado.
        protectedApp.get('/api/cashier/employees', getCashierEmployees)

        protectedApp.get('/api/cashier/sessions', getSessions)
        protectedApp.get('/api/cashier/monthly-audit', getMonthlyCashAudit)
        protectedApp.get('/api/cashier/session/:id', getSessionDetails)
        protectedApp.put('/api/cashier/session/:id/balance', updateCashierSessionBalance)
        protectedApp.delete('/api/cashier/sessions/:id', deleteSession)
        protectedApp.delete('/api/cashier/delivery-orders/:id', deleteOnlineOrder)
        
        protectedApp.post('/api/cashier/session/open', openCashierSession)
        protectedApp.get('/api/cashier/session/active', getActiveSession)
        protectedApp.post('/api/cashier/session/close', closeCashierSession)
        protectedApp.post('/api/cashier/session/submit', submitCashierForReview)
        protectedApp.post('/api/cashier/session/audit', auditCashierSession)
        protectedApp.post('/api/cashier/session/revert', revertCashierAudit)
        protectedApp.post('/api/cashier/session/resolve-divergence', resolveCashierDivergence)
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
