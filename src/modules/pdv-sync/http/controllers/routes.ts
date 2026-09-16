import { FastifyInstance } from 'fastify'
import {
    getProductsSync,
    postProductsBulkSync,
    getUsersSync,
    getEmployeesSync,
    postStocksSync,
    getSyncStatus,
    getClientsSync,
    postClientsSync,
    getPrintDepartmentsSync,
    getPaymentsSync,
    getPaymentIdentifiersSync,
    getPaymentConditionsSync,
    getPOSMachinesSync,
    getSystemConfigSync,
    postCancellationsSync
} from './pdv-sync-controller'
import { postSalesSync } from './sales-sync-controller'
import { postTablesSync, getTablesTelemetry } from './tables-sync-controller'
import { postCashierOpenSync, postCashierMovementsSync, postCashierCloseSync } from './cashier-sync-controller'
import {
    getGarcomCardapio,
    getGarcomMesas,
    getGarcomMesaDetalhes,
    postGarcomAbrirMesa,
    postGarcomLancarItens,
    postGarcomPedirConta
} from './garcom-cloud-controller'

export async function pdvSyncRoutes(app: FastifyInstance) {
    app.addHook('preHandler', async (request, reply) => {
        // Rotas do Garçom Móvel podem autenticar via chave específica ou passar direto para testes de salão
        if (request.url.startsWith('/api/garcom/')) {
            return
        }

        const apiKey = request.headers['x-api-key']
        const validKey = process.env.PDV_API_KEY || 'chave-secreta-pdv-123'
        if (apiKey !== validKey) {
            return reply.status(401).send({ message: 'Acesso não autorizado: Chave de API PDV inválida' })
        }
    })

    // Watermark / Delta status
    app.get('/api/pdv/sync/status', getSyncStatus)
    app.get('/api/pdv/status', getSyncStatus)

    // Catálogo e Produtos
    app.get('/api/pdv/sync/products', getProductsSync)
    app.post('/api/pdv/sync/products/bulk', postProductsBulkSync)
    app.post('/api/pdv/products/bulk', postProductsBulkSync)
    app.get('/api/pdv/products', getProductsSync)

    // Usuários e Colaboradores
    app.get('/api/pdv/sync/users', getUsersSync)
    app.get('/api/pdv/users', getUsersSync)
    app.get('/api/pdv/sync/employees', getEmployeesSync)
    app.get('/api/pdv/employees', getEmployeesSync)

    // Clientes e Endereços
    app.get('/api/pdv/sync/clients', getClientsSync)
    app.post('/api/pdv/sync/clients', postClientsSync)
    app.get('/api/pdv/clients', getClientsSync)
    app.post('/api/pdv/clients', postClientsSync)

    // Vendas e Estoque
    app.post('/api/pdv/sync/stocks', postStocksSync)
    app.post('/api/pdv/stocks', postStocksSync)
    app.post('/api/pdv/sync/sales', postSalesSync)
    app.post('/api/pdv/sales', postSalesSync)

    // Cancelamentos Unificados
    app.post('/api/pdv/sync/cancellations', postCancellationsSync)
    app.post('/api/pdv/cancellations', postCancellationsSync)

    // Telemetria de Mesas e Salão
    app.post('/api/pdv/sync/tables', postTablesSync)
    app.post('/api/pdv/tables', postTablesSync)
    app.get('/api/pdv/sync/tables', getTablesTelemetry)
    app.get('/api/pdv/tables', getTablesTelemetry)

    // Sessões de Caixa
    app.post('/api/pdv/sync/cashier/open', postCashierOpenSync)
    app.post('/api/pdv/cashier/open', postCashierOpenSync)
    app.post('/api/pdv/sync/cashier/movements', postCashierMovementsSync)
    app.post('/api/pdv/cashier/movements', postCashierMovementsSync)
    app.post('/api/pdv/sync/cashier/close', postCashierCloseSync)
    app.post('/api/pdv/cashier/close', postCashierCloseSync)

    // Departamentos e Configurações Financeiras
    app.get('/api/pdv/sync/print-departments', getPrintDepartmentsSync)
    app.get('/api/pdv/print-departments', getPrintDepartmentsSync)
    app.get('/api/pdv/sync/payments', getPaymentsSync)
    app.get('/api/pdv/payments', getPaymentsSync)
    app.get('/api/pdv/sync/payment-identifiers', getPaymentIdentifiersSync)
    app.get('/api/pdv/payment-identifiers', getPaymentIdentifiersSync)
    app.get('/api/pdv/sync/payment-conditions', getPaymentConditionsSync)
    app.get('/api/pdv/payment-conditions', getPaymentConditionsSync)
    app.get('/api/pdv/sync/pos-machines', getPOSMachinesSync)
    app.get('/api/pdv/pos-machines', getPOSMachinesSync)
    app.get('/api/pdv/sync/config', getSystemConfigSync)
    app.get('/api/pdv/config', getSystemConfigSync)

    // Rotas de Salão Direto para Garçom Móvel (Contingência / Nuvem)
    app.get('/api/garcom/cardapio', getGarcomCardapio)
    app.get('/api/garcom/mesas', getGarcomMesas)
    app.get('/api/garcom/mesas/:id', getGarcomMesaDetalhes)
    app.post('/api/garcom/mesas/abrir', postGarcomAbrirMesa)
    app.post('/api/garcom/mesas/:mesaId/itens', postGarcomLancarItens)
    app.post('/api/garcom/mesas/:mesaId/pedir-conta', postGarcomPedirConta)
}
