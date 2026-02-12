import { FastifyInstance } from 'fastify'
import { create } from '@/modules/products/http/controllers/create'
import { getMany } from '@/modules/products/http/controllers/get-many'
import { getById } from '@/modules/products/http/controllers/get-by-id'
import { update } from '@/modules/products/http/controllers/update'
import { getNextId } from '@/modules/products/http/controllers/get-next-id'
import { checkCode } from '@/modules/products/http/controllers/check-code'
import { verifyJwt } from '@/http/middlewares/verify-jwt'

export async function productsRoutes(app: FastifyInstance) {
    app.addHook('onRequest', verifyJwt)

    app.post('/products', create)
    app.get('/products', getMany)
    app.get('/products/next-id', getNextId)
    app.get('/products/check-code', checkCode)
    app.get('/products/:id', getById)
    app.patch('/products/:id', update)
}
