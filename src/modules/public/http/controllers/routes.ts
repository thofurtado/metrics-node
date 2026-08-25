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
import { createOnlineOrder } from './create-online-order'
import { getPendingOnlineOrders } from './get-pending-online-orders'
import { updateOnlineOrderStatus } from './update-online-order-status'
import { ordersStream } from './orders-stream'
import { getLatestWindyVersion, downloadLatestWindy, uploadWindyRelease } from './windy-downloads'
import { getLatestPdvVersion, downloadLatestPdv, uploadPdvRelease } from './pdv-downloads'
import { getClientsSummaryForWindy, bindDeviceFromWindy } from './windy-device'
import { getEquipmentHistory } from './get-equipment-history'

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

    // Pipeline do Cardápio Online & PDV
    app.post('/public/orders', createOnlineOrder)
    app.get('/public/orders/pending', getPendingOnlineOrders)
    app.get('/api/pdv/orders/pending', getPendingOnlineOrders)
    app.get('/public/orders/stream', ordersStream)
    app.get('/api/pdv/orders/stream', ordersStream)
    app.patch('/public/orders/:id/status', updateOnlineOrderStatus)
    app.patch('/api/pdv/orders/:id/status', updateOnlineOrderStatus)

    // Distribuição, Vinculação e Auto-Update do Windy
    // Prontuário e Histórico Público de Equipamento
    app.get('/public/equipments/:id/history', getEquipmentHistory)
    app.get('/api/public/equipments/:id/history', getEquipmentHistory)
    app.get('/api/public/windy/clients-summary', getClientsSummaryForWindy)
    app.post('/api/public/windy/bind-device', bindDeviceFromWindy)
    app.get('/api/public/windy/latest', getLatestWindyVersion)
    app.get('/public/windy/latest', getLatestWindyVersion)
    app.get('/api/public/windy/download', downloadLatestWindy)
    app.get('/downloads/Metrics_Windy_Setup.exe', downloadLatestWindy)
    app.post('/api/admin/downloads/windy', uploadWindyRelease)

    // Distribuição e Auto-Update do Metrics PDV
    app.get('/api/public/pdv/latest', getLatestPdvVersion)
    app.get('/public/pdv/latest', getLatestPdvVersion)
    app.get('/api/public/pdv/download', downloadLatestPdv)
    app.get('/downloads/Instalar_MetricsPDV.exe', downloadLatestPdv)
    app.post('/api/admin/downloads/pdv', uploadPdvRelease)

    app.get('/public/health', async (_, reply) => {
        return reply.status(200).send({ status: 'ok' })
    })
}
