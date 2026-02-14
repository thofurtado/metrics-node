import { FastifyInstance } from 'fastify'


import { verifyJwt } from '@/http/middlewares/verify-jwt'
import { createItem } from '@/modules/items/http/controllers/item'
import { createStock } from '@/modules/items/http/controllers/stock'
import { getItemHistory } from '@/modules/items/http/controllers/getItemHistory'
import { updateItem } from '@/modules/items/http/controllers/updateItem'
import { deleteItem } from '@/modules/items/http/controllers/deleteItem'
import { getInventorySummary } from '@/modules/items/http/controllers/get-inventory-summary'



import { getProducts } from '@/modules/items/http/controllers/getProducts'
import { getServices } from '@/modules/items/http/controllers/getServices'
import { getSupplies } from '@/modules/items/http/controllers/getSupplies'

import { registerStockMovement } from '@/modules/items/http/controllers/register-stock-movement'

export async function itemsRoutes(app: FastifyInstance) {
    app.addHook('onRequest', verifyJwt)


    app.post('/item', createItem)
    app.patch('/item/:id', updateItem)
    app.delete('/item/:id', deleteItem)

    // Novas rotas especializadas (Comentadas pois já existem nos módulos nativos)
    // app.get('/products', getProducts)
    // app.get('/services', getServices)
    // app.get('/supplies', getSupplies)

    // Rota legada mantida temporariamente ou removida se confirmado
    // app.get('/items', getItems)

    app.post('/stock', createStock)
    app.post('/stock/movement', registerStockMovement)
    app.get('/item-stocks/:id', getItemHistory)
    app.get('/inventory-summary', getInventorySummary)
}
