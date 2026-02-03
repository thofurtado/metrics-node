import { FastifyInstance } from 'fastify'
import { create } from './create'
import { getMany } from './get-many'
import { verifyJWT } from '@/http/middlewares/verify-jwt'

export async function suppliesRoutes(app: FastifyInstance) {
    app.addHook('onRequest', verifyJWT)

    app.post('/supplies', create)
    app.get('/supplies', getMany)
}
