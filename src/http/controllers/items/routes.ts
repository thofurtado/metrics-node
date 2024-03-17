import { FastifyInstance } from 'fastify'


import { verifyJWT } from '@/http/middlewares/verify-jwt'
import { createItem } from './item'
import { createStock } from './stock'
import { getItems } from './getItems'
import { getItemHistory } from './getItemHistory'



export async function itemsRoutes(app: FastifyInstance) {
    app.addHook('onRequest', verifyJWT)


    app.post('/item', createItem)
    app.post('/stock', createStock)
    app.get('/items', getItems)
    app.get('/item-stocks/:id', getItemHistory)

}
