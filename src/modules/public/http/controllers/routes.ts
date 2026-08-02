import { FastifyInstance } from 'fastify'
import { getMenu } from './get-menu'
import { getClientByPhone } from './get-client-by-phone'
import { checkoutClient } from './checkout-client'
import { getReceipt } from './get-receipt'
import { provisionTenant } from './provision'
import { deprovisionTenant } from './deprovision'
import { getTenantInfo } from './get-tenant-info'
import { getDbStatus } from './db-status'
import { syncTenantDb } from './db-sync'
import { getProfile } from './get-profile'

export async function publicRoutes(app: FastifyInstance) {
    app.get('/public/menu', getMenu)
    app.get('/public/clients/phone/:phone', getClientByPhone)
    app.post('/public/checkout/client', checkoutClient)
    app.get('/public/transactions/:id/receipt', getReceipt)
    app.post('/public/provision', provisionTenant)
    app.delete('/public/provision/:dbName', deprovisionTenant)
    app.get('/public/tenant-info', getTenantInfo)
    app.get('/public/db-status', getDbStatus)
    app.post('/public/db-sync', syncTenantDb)
    app.get('/public/profile', getProfile)

    app.get('/public/health', async (_, reply) => {
        return reply.status(200).send({ status: 'ok' })
    })
}
