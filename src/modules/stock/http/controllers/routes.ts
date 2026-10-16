import { FastifyInstance } from 'fastify'
import { verifyJwt } from '@/http/middlewares/verify-jwt'
import { verifyModuleAccess } from '@/http/middlewares/verify-module-access'
import {
    postParseNfe,
    postConfirmNfe,
    postOpenInventorySession,
    getInventorySessionDetails,
    postApplyInventorySession
} from './nfe-stock-controller'
import {
    getStockOverview,
    postAdjustStockBalance,
    postCreateStockSupply,
    getActiveInventorySession,
    getRecipeConsumption,
} from './stock-dashboard-controller'
import { getItemStockHistory, getStockItemsSearch, getStockMovements, getStockOrigin } from './stock-history-controller'

// Fase 0 do Mergulho (17:U1): o estoque avançado (posição, ajustes, NF-e, inventário, movimentos) só é chamado pela tela
// de Estoque da web, que exige o módulo Controle de Estoque. Cada rota já tem o verifyJwt próprio (roda antes).
const travaEstoque = verifyModuleAccess('stock')
// Histórico na ficha do produto (Mercadorias, D6): quem tem o módulo Itens OU o Controle de Estoque vê
const travaHistoricoDoItem = verifyModuleAccess('items', 'stock')

export async function stockAdvancedRoutes(app: FastifyInstance) {
    app.addHook('preHandler', async (request, reply) => {
        if ((request.routeOptions.url || '').startsWith('/api/stock/')) return travaEstoque(request, reply)
    })
    // 1. Posição de Estoque & Ajustes Rápidos
    app.get('/api/stock/overview', { onRequest: [verifyJwt] }, getStockOverview)
    app.post('/api/stock/adjust', { onRequest: [verifyJwt] }, postAdjustStockBalance)
    app.post('/api/stock/supplies', { onRequest: [verifyJwt] }, postCreateStockSupply)

    // 2. Gestão de NFe / Entrada de Mercadorias
    app.post('/api/stock/nfe/parse', { onRequest: [verifyJwt] }, postParseNfe)
    app.post('/api/stock/nfe/confirm', { onRequest: [verifyJwt] }, postConfirmNfe)
    
    // 3. Consumo por Ficha Técnica (Visão BOH & Auditoria)
    app.get('/api/stock/recipe-consumption', { onRequest: [verifyJwt] }, getRecipeConsumption)

    // 4. Inventário / Contagem Cega
    app.get('/api/stock/inventory/active', { onRequest: [verifyJwt] }, getActiveInventorySession)
    app.post('/api/stock/inventory/open', { onRequest: [verifyJwt] }, postOpenInventorySession)
    app.get('/api/stock/inventory/:id', { onRequest: [verifyJwt] }, getInventorySessionDetails)
    app.post('/api/stock/inventory/apply', { onRequest: [verifyJwt] }, postApplyInventorySession)

    // 5. Histórico / Extrato de Movimentações (D6: a mesma consulta no Controle de Estoque e na ficha do produto)
    app.get('/api/stock/movements', { onRequest: [verifyJwt] }, getStockMovements)
    app.get('/api/stock/origin', { onRequest: [verifyJwt] }, getStockOrigin)
    app.get('/api/stock/items', { onRequest: [verifyJwt] }, getStockItemsSearch)
    app.get('/items/:id/stock-history', { onRequest: [verifyJwt], preHandler: [travaHistoricoDoItem] }, getItemStockHistory)
    app.get('/items/stock-origin', { onRequest: [verifyJwt], preHandler: [travaHistoricoDoItem] }, getStockOrigin)
}
