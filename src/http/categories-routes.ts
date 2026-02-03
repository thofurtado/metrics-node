import { FastifyInstance } from 'fastify'
import { create } from './controllers/categories/create'
import { fetch } from './controllers/categories/fetch'
import { verifyJwt } from './middlewares/verify-jwt'

export async function categoriesRoutes(app: FastifyInstance) {
    app.post('/categories', { onRequest: [verifyJwt] }, create)
    app.get('/categories', { onRequest: [verifyJwt] }, fetch)
}
