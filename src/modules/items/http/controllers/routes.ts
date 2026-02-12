import { FastifyInstance } from 'fastify'


import { verifyJwt } from '@/http/middlewares/verify-jwt'
import { createItem } from '@/modules/items/http/controllers/item'
import { createStock } from '@/modules/items/http/controllers/stock'
import { getItems } from '@/modules/items/http/controllers/getItems'
import { getItemHistory } from '@/modules/items/http/controllers/getItemHistory'
import { updateItem } from '@/modules/items/http/controllers/updateItem'
import { deleteItem } from '@/modules/items/http/controllers/deleteItem'
import { getInventorySummary } from '@/modules/items/http/controllers/get-inventory-summary'



import { registerStockMovement } from '@/modules/items/http/controllers/register-stock-movement'

export async function itemsRoutes(app: FastifyInstance) {
    app.addHook('onRequest', verifyJwt)


    app.post('/item', createItem)
    app.patch('/item/:id', updateItem)
    app.delete('/item/:id', deleteItem)
    app.post('/stock', createStock)
    app.post('/stock/movement', registerStockMovement)
    app.get('/items', getItems)
    app.get('/item-stocks/:id', getItemHistory)
    app.get('/inventory-summary', getInventorySummary) // Kept existing route

}
