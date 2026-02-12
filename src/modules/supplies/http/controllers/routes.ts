import { FastifyInstance } from 'fastify'
import { create } from '@/modules/supplies/http/controllers/create'
import { getMany } from '@/modules/supplies/http/controllers/get-many'
import { verifyJwt } from '@/http/middlewares/verify-jwt'

export async function suppliesRoutes(app: FastifyInstance) {
    app.addHook('onRequest', verifyJwt)

    app.post('/supplies', create)
    app.get('/supplies', getMany)
}
