import { FastifyInstance } from 'fastify'


import { verifyJWT } from '@/http/middlewares/verify-jwt'
import { createItem } from './item'
import { createStock } from './stock'
import { getItems } from './getItems'
import { getItemHistory } from './getItemHistory'
import { updateItem } from './updateItem'
import { deleteItem } from './deleteItem'
import { getInventorySummary } from './get-inventory-summary'



export async function itemsRoutes(app: FastifyInstance) {
    app.addHook('onRequest', verifyJWT)


    app.post('/item', createItem)
    app.patch('/item/:id', updateItem)
    app.delete('/item/:id', deleteItem)
    app.post('/stock', createStock)
    app.get('/items', getItems)
    app.get('/item-stocks/:id', getItemHistory)
    app.get('/inventory-summary', getInventorySummary) // Kept existing route

}
