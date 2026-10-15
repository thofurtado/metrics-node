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
    postCancellationsSync, getCancellationsSync
} from './pdv-sync-controller'
import { postSalesSync } from './sales-sync-controller'
import { createDeliveryItemMapping } from '@/modules/delivery/http/controllers/delivery-item-mapping'
import { postIfoodDeliveryCode } from './delivery-code-controller'
import { getIbptSync } from './ibpt-sync-controller'
import { getCostsSync } from './costs-sync-controller'
import { postTablesSync, getTablesTelemetry } from './tables-sync-controller'
import { postCashierOpenSync, postCashierMovementsSync, postCashierCloseSync, getOpenCashierSessions } from './cashier-sync-controller'
import { postClusterVivo } from './cluster-controller'
import { postCouriersSync, postCourierPayablesSync } from './couriers-sync-controller'
import { getOrdersSituation } from './orders-situation-controller'
import {
    getGarcomCardapio,
    getGarcomMesas,
    getGarcomMesaDetalhes,
    postGarcomAbrirMesa,
    postGarcomLancarItens,
    postGarcomPedirConta
} from './garcom-cloud-controller'

/**
 * A chave do PDV (cabeçalho x-api-key). Fase 0 do Mergulho (02:P1, 15/10/2026): uma regra só, usada pela sincronia e pelas
 * rotas de pedidos do PDV (public/http/autorizacao-pedidos.ts). A troca de chaves (02:P2) muda a regra AQUI, e as duas
 * seguem juntas.
 */
export function chaveDoPdvValida(header: unknown): boolean {
    const validKey = process.env.PDV_API_KEY || 'chave-secreta-pdv-123'
    return typeof header === 'string' && header !== '' && header === validKey
}

export async function pdvSyncRoutes(app: FastifyInstance) {
    app.addHook('preHandler', async (request, reply) => {
        // Rotas do Garçom Móvel podem autenticar via chave específica ou passar direto para testes de salão
        if (request.url.startsWith('/api/garcom/')) {
            return
        }

        if (!chaveDoPdvValida(request.headers['x-api-key'])) {
            return reply.status(401).send({ message: 'Acesso não autorizado: Chave de API PDV inválida' })
        }
    })

    // Botão "Vincular" do PDV (12/10/2026): item do iFood/99 sem produto -> produto do Metrics. A mesma função da tela
    // Vínculos com Delivery da web (vale para os próximos pedidos e corrige os antigos na nuvem), com a chave do PDV.
    app.post('/api/pdv/delivery/item-mappings', createDeliveryItemMapping)
    // Código de entrega do iFood digitado no PDV (12/10/2026): a nuvem confirma no iFood
    app.post('/api/pdv/orders/:id/delivery-code', postIfoodDeliveryCode)
    // Situação de pedidos de dias anteriores que o PDV ainda tem abertos (13/10/2026: o #5706 da Katatau ficou na rua)
    app.get('/api/pdv/orders/situacao', getOrdersSituation)

    // Watermark / Delta status
    app.get('/api/pdv/sync/status', getSyncStatus)
    app.get('/api/pdv/status', getSyncStatus)

    // Catálogo e Produtos
    app.get('/api/pdv/sync/products', getProductsSync)
    app.post('/api/pdv/sync/products/bulk', postProductsBulkSync)
    app.post('/api/pdv/products/bulk', postProductsBulkSync)
    app.get('/api/pdv/products', getProductsSync)

    // Custos vigentes (produto e complemento) para o PDV congelar em cada venda
    app.get('/api/pdv/sync/costs', getCostsSync)
    app.get('/api/pdv/costs', getCostsSync)

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
    app.post('/pdv/sync/cancellations', postCancellationsSync)
    app.get('/api/pdv/sync/cancellations', getCancellationsSync)
    app.get('/api/pdv/cancellations', getCancellationsSync)
    app.get('/pdv/sync/cancellations', getCancellationsSync)

    // Telemetria de Mesas e Salão
    app.post('/api/pdv/sync/tables', postTablesSync)
    app.post('/api/pdv/tables', postTablesSync)
    app.post('/pdv/sync/tables', postTablesSync)
    app.get('/api/pdv/sync/tables', getTablesTelemetry)
    app.get('/api/pdv/tables', getTablesTelemetry)
    app.get('/pdv/sync/tables', getTablesTelemetry)
    app.get('/pdv/sync/tables/snapshot', getTablesTelemetry)
    app.get('/api/pdv/sync/tables/snapshot', getTablesTelemetry)

    // Troca automática de servidor do PDV (02/10/2026): "estou vivo" de cada computador da ordem e juiz contra dois servidores
    app.post('/api/pdv/cluster/vivo', postClusterVivo)

    // Sessões de Caixa
    app.post('/api/pdv/sync/cashier/open', postCashierOpenSync)
    app.post('/api/pdv/cashier/open', postCashierOpenSync)
    app.post('/api/pdv/sync/cashier/movements', postCashierMovementsSync)
    app.post('/api/pdv/cashier/movements', postCashierMovementsSync)
    app.post('/api/pdv/sync/cashier/close', postCashierCloseSync)
    app.get('/api/pdv/sync/cashier/open-sessions', getOpenCashierSessions)
    app.post('/api/pdv/cashier/close', postCashierCloseSync)

    // Motoboys e entregas/diárias a pagar (15/10/2026): o PDV é a fonte; a web só lê (relatório dos motoboys)
    app.post('/api/pdv/sync/couriers', postCouriersSync)
    app.post('/api/pdv/sync/courier-payables', postCourierPayablesSync)

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

    // De Olho no Imposto: alíquotas dos NCMs que o PDV usa (o token do cliente fica só no backend)
    app.get('/api/pdv/sync/ibpt', getIbptSync)

    // Rotas de Salão Direto para Garçom Móvel (Contingência / Nuvem)
    app.get('/api/garcom/cardapio', getGarcomCardapio)
    app.get('/api/garcom/mesas', getGarcomMesas)
    app.get('/api/garcom/mesas/:id', getGarcomMesaDetalhes)
    app.post('/api/garcom/mesas/abrir', postGarcomAbrirMesa)
    app.post('/api/garcom/mesas/:mesaId/itens', postGarcomLancarItens)
    app.post('/api/garcom/mesas/:mesaId/pedir-conta', postGarcomPedirConta)
}
