import { FastifyInstance } from 'fastify'
import { create } from './create'
import { getMany } from './get-many'
import { getById } from './get-by-id'
import { update } from './update'
import { verifyJWT } from '@/http/middlewares/verify-jwt'

export async function productsRoutes(app: FastifyInstance) {
    app.addHook('onRequest', verifyJWT)

    app.post('/products', create)
    app.get('/products', getMany)
    app.get('/products/:id', getById)
    app.patch('/products/:id', update)
}
