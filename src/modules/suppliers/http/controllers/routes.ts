import { FastifyInstance } from 'fastify'
import { verifyJwt } from '@/http/middlewares/verify-jwt'
import { create } from '@/modules/suppliers/http/controllers/create'
import { fetch } from '@/modules/suppliers/http/controllers/fetch'
import { update } from '@/modules/suppliers/http/controllers/update'
import { remove } from '@/modules/suppliers/http/controllers/delete'

export async function suppliersRoutes(app: FastifyInstance) {
    app.addHook('onRequest', verifyJwt)

    app.post('/suppliers', create)
    app.get('/suppliers', fetch)
    app.put('/suppliers/:id', update)
    app.delete('/suppliers/:id', remove)
}
