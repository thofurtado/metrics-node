import { FastifyInstance } from 'fastify'
import { create } from './create'
import { fetch } from './fetch'
import { verifyJWT } from '../../middlewares/verify-jwt'

export async function categoriesRoutes(app: FastifyInstance) {
    app.post('/categories', { onRequest: [verifyJWT] }, create)
    app.get('/categories', { onRequest: [verifyJWT] }, fetch)
}
