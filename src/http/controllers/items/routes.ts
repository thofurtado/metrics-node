import { FastifyInstance } from 'fastify'


import { verifyJWT } from '@/http/middlewares/verify-jwt'
import { createItem } from './item'
import { createStock } from './stock'



export async function itemsRoutes(app: FastifyInstance) {
    app.addHook('onRequest', verifyJWT)


    app.post('/item', createItem)
    app.post('/stock', createStock)

}
