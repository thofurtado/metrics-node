import { FastifyInstance } from 'fastify'
import { create } from '@/modules/services/http/controllers/create'
import { getMany } from '@/modules/services/http/controllers/get-many'
import { verifyJwt } from '@/http/middlewares/verify-jwt'

export async function servicesRoutes(app: FastifyInstance) {
    app.addHook('onRequest', verifyJwt)

    app.post('/services', create)
    app.get('/services', getMany)
}
