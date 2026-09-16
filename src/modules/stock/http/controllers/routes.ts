import { FastifyInstance } from 'fastify'
import { verifyJwt } from '@/http/middlewares/verify-jwt'
import {
    postParseNfe,
    postConfirmNfe,
    postOpenInventorySession,
    getInventorySessionDetails,
    postApplyInventorySession
} from './nfe-stock-controller'

export async function stockAdvancedRoutes(app: FastifyInstance) {
    // Endpoints protegidos para gestão de NFe e Inventário
    app.post('/api/stock/nfe/parse', { onRequest: [verifyJwt] }, postParseNfe)
    app.post('/api/stock/nfe/confirm', { onRequest: [verifyJwt] }, postConfirmNfe)
    
    // Inventário / Contagem Cega
    app.post('/api/stock/inventory/open', { onRequest: [verifyJwt] }, postOpenInventorySession)
    app.get('/api/stock/inventory/:id', { onRequest: [verifyJwt] }, getInventorySessionDetails)
    app.post('/api/stock/inventory/apply', { onRequest: [verifyJwt] }, postApplyInventorySession)
}
