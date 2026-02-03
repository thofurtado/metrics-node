import { FastifyInstance } from 'fastify'
import { create } from './create'
import { getMany } from './get-many'
import { verifyJWT } from '@/http/middlewares/verify-jwt'

export async function servicesRoutes(app: FastifyInstance) {
    app.addHook('onRequest', verifyJWT)

    app.post('/services', create)
    app.get('/services', getMany)
}
