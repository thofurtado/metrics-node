import { verifyJwt } from '@/http/middlewares/verify-jwt'
import { FastifyInstance } from 'fastify'
import { create } from './create'

export async function salesRoutes(app: FastifyInstance) {
    app.post('/sales', { onRequest: [verifyJwt] }, create)
}
