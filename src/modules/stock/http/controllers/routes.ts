import { FastifyInstance } from 'fastify'
import { verifyJwt } from '@/http/middlewares/verify-jwt'
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
    getStockMovements
} from './stock-dashboard-controller'

export async function stockAdvancedRoutes(app: FastifyInstance) {
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

    // 5. Histórico / Extrato de Movimentações
    app.get('/api/stock/movements', { onRequest: [verifyJwt] }, getStockMovements)
}
