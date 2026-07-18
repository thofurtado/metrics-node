import { FastifyInstance } from 'fastify'
import { getMenu } from './get-menu'
import { getClientByPhone } from './get-client-by-phone'
import { checkoutClient } from './checkout-client'
import { getReceipt } from './get-receipt'
import { provisionTenant } from './provision'
import { deprovisionTenant } from './deprovision'

export async function publicRoutes(app: FastifyInstance) {
    app.get('/public/menu', getMenu)
    app.get('/public/clients/phone/:phone', getClientByPhone)
    app.post('/public/checkout/client', checkoutClient)
    app.get('/public/transactions/:id/receipt', getReceipt)
    app.post('/public/provision', provisionTenant)
    app.delete('/public/provision/:dbName', deprovisionTenant)

    app.get('/public/health', async (_, reply) => {
        return reply.status(200).send({ status: 'ok' })
    })
}
