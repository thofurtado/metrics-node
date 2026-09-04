import { FastifyInstance } from 'fastify'
import { getProductsSync, postProductsBulkSync, getUsersSync, postStocksSync, getSyncStatus, getClientsSync, postClientsSync, getPrintDepartmentsSync, getPaymentsSync, getPaymentIdentifiersSync, getPaymentConditionsSync, getPOSMachinesSync, getSystemConfigSync } from './pdv-sync-controller'
import { postSalesSync } from './sales-sync-controller'
import { postTablesSync, getTablesTelemetry } from './tables-sync-controller'
import { postCashierOpenSync, postCashierMovementsSync, postCashierCloseSync } from './cashier-sync-controller'

export async function pdvSyncRoutes(app: FastifyInstance) {
    app.addHook('preHandler', async (request, reply) => {
        const apiKey = request.headers['x-api-key']
        // We're using the same or similar logic as we have in app.ts for pdv-sync
        const validKey = process.env.PDV_API_KEY || 'chave-secreta-pdv-123'
        if (apiKey !== validKey) {
            return reply.status(401).send({ message: 'Acesso não autorizado: Chave de API PDV inválida' })
        }
    })

    app.get('/api/pdv/sync/status', getSyncStatus)
    app.get('/api/pdv/status', getSyncStatus)

    app.get('/api/pdv/sync/products', getProductsSync)
    app.post('/api/pdv/sync/products/bulk', postProductsBulkSync)
    app.post('/api/pdv/products/bulk', postProductsBulkSync)
    app.get('/api/pdv/sync/users', getUsersSync)
    app.get('/api/pdv/sync/clients', getClientsSync)
    app.post('/api/pdv/sync/stocks', postStocksSync)
    app.post('/api/pdv/sync/clients', postClientsSync)
    app.post('/api/pdv/sync/sales', postSalesSync)
    app.post('/api/pdv/sync/tables', postTablesSync)
    app.post('/api/pdv/tables', postTablesSync)
    app.get('/api/pdv/sync/tables', getTablesTelemetry)
    app.get('/api/pdv/tables', getTablesTelemetry)
    app.post('/api/pdv/sync/cashier/open', postCashierOpenSync)
    app.post('/api/pdv/cashier/open', postCashierOpenSync)
    app.post('/api/pdv/sync/cashier/movements', postCashierMovementsSync)
    app.post('/api/pdv/cashier/movements', postCashierMovementsSync)
    app.post('/api/pdv/sync/cashier/close', postCashierCloseSync)
    app.post('/api/pdv/cashier/close', postCashierCloseSync)
    
    app.get('/api/pdv/sync/payments', getPaymentsSync)
    app.get('/api/pdv/sync/payment-identifiers', getPaymentIdentifiersSync)
    app.get('/api/pdv/sync/payment-conditions', getPaymentConditionsSync)
    app.get('/api/pdv/sync/pos-machines', getPOSMachinesSync)
    app.get('/api/pdv/sync/config', getSystemConfigSync)
    
    // Suporte também a rota sem /sync/ para bater com a chamada do App.xaml.cs, se for diferente
    app.get('/api/pdv/products', getProductsSync)
    app.get('/api/pdv/users', getUsersSync)
    app.get('/api/pdv/clients', getClientsSync)
    app.post('/api/pdv/stocks', postStocksSync)
    app.post('/api/pdv/clients', postClientsSync)
    app.get('/api/pdv/sync/print-departments', getPrintDepartmentsSync)
    app.get('/api/pdv/print-departments', getPrintDepartmentsSync)
    
    app.post('/api/pdv/sales', postSalesSync)
    app.get('/api/pdv/payments', getPaymentsSync)
    app.get('/api/pdv/payment-identifiers', getPaymentIdentifiersSync)
    app.get('/api/pdv/payment-conditions', getPaymentConditionsSync)
    app.get('/api/pdv/pos-machines', getPOSMachinesSync)
    app.get('/api/pdv/config', getSystemConfigSync)
}
