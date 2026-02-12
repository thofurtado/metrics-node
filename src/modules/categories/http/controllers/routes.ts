import { FastifyInstance } from 'fastify'
import { create } from '@/modules/categories/http/controllers/create'
import { fetch } from '@/modules/categories/http/controllers/fetch'
import { verifyJwt } from '@/http/middlewares/verify-jwt'

export async function categoriesRoutes(app: FastifyInstance) {
    app.post('/categories', { onRequest: [verifyJwt] }, create)
    app.get('/categories', { onRequest: [verifyJwt] }, fetch)
}
