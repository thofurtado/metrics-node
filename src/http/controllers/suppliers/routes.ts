import { FastifyInstance } from 'fastify'
import { verifyJwt } from '@/http/middlewares/verify-jwt'
import { create } from './create'
import { fetch } from './fetch'
import { update } from './update'
import { remove } from './delete'

export async function suppliersRoutes(app: FastifyInstance) {
    app.addHook('onRequest', verifyJwt)

    app.post('/suppliers', create)
    app.get('/suppliers', fetch)
    app.put('/suppliers/:id', update)
    app.delete('/suppliers/:id', remove)
}
