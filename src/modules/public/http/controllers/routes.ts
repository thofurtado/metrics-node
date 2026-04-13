import { FastifyInstance } from 'fastify'
import { getMenu } from './get-menu'
import { getClientByPhone } from './get-client-by-phone'
import { checkoutClient } from './checkout-client'
import { getReceipt } from './get-receipt'

export async function publicRoutes(app: FastifyInstance) {
    app.get('/public/menu', getMenu)
    app.get('/public/clients/phone/:phone', getClientByPhone)
    app.post('/public/checkout/client', checkoutClient)
    app.get('/public/transactions/:id/receipt', getReceipt)

    app.get('/public/health', async (_, reply) => {
        return reply.status(200).send({ status: 'ok' })
    })
}
