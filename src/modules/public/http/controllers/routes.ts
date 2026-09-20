import { getAppsCatalog, getAppLatestVersion, downloadApp, uploadAppRelease } from './unified-downloads'
import { FastifyInstance } from 'fastify'
import { getMenu } from './get-menu'
import { getClientByPhone } from './get-client-by-phone'
import { checkoutClient } from './checkout-client'
import { getReceipt } from './get-receipt'
import { provisionTenant } from './provision'
import { deprovisionTenant } from './deprovision'
import { getTenantInfo } from './get-tenant-info'
import { getDbStatus } from './db-status'
import { syncTenantDb, syncAllTenantsDb } from './db-sync'
import { getProfile } from './get-profile'
import { createOnlineOrder } from './create-online-order'
import { getPendingOnlineOrders } from './get-pending-online-orders'
import { updateOnlineOrderStatus } from './update-online-order-status'
import { getOrderCancellationReasons } from './get-order-cancellation-reasons'
import { associateOrphanOrders } from './associate-orphan-orders'
import { webPushManager, VAPID_PUBLIC_KEY } from '@/lib/web-push-manager'
import { getOnlineOrderStatus } from './get-online-order-status'
import { ordersStream } from './orders-stream'
import { getLatestWindyVersion, downloadLatestWindy, uploadWindyRelease } from './windy-downloads'
import { getLatestPdvVersion, downloadLatestPdv, uploadPdvRelease } from './pdv-downloads'
import { getClientsSummaryForWindy, bindDeviceFromWindy, getTenantByCode } from './windy-device'
import { getEquipmentHistory } from './get-equipment-history'
import { saveIfoodCredentialsController } from './saas-ifood-credentials'

export async function publicRoutes(app: FastifyInstance) {
    app.get('/public/menu', getMenu)
    app.get('/public/clients/phone/:phone', getClientByPhone)
    app.post('/public/checkout/client', checkoutClient)
    app.get('/public/transactions/:id/receipt', getReceipt)
    app.post('/public/provision', provisionTenant)
    app.put('/public/saas/ifood-credentials', saveIfoodCredentialsController)
    app.delete('/public/provision/:dbName', deprovisionTenant)
    app.get('/public/tenant-info', getTenantInfo)
    app.get('/public/db-status', getDbStatus)
    app.post('/public/db-sync', syncTenantDb)
    app.post('/public/db-sync-all', syncAllTenantsDb)
    app.get('/public/profile', getProfile)

    // Pipeline do CardÃ¡pio Online & PDV
    app.post('/public/orders', createOnlineOrder)
    app.post('/api/pdv/orders', createOnlineOrder)
    app.get('/public/orders/pending', getPendingOnlineOrders)
    app.get('/api/pdv/orders/pending', getPendingOnlineOrders)
    app.get('/public/orders/stream', ordersStream)
    app.get('/api/pdv/orders/stream', ordersStream)
    app.get('/public/orders/:id/status', getOnlineOrderStatus)
    app.get('/public/orders/:id/cancellation-reasons', getOrderCancellationReasons)
    app.get('/api/pdv/orders/:id/cancellation-reasons', getOrderCancellationReasons)
    app.patch('/public/orders/:id/status', updateOnlineOrderStatus)
    app.post('/public/orders/associate-orphans', associateOrphanOrders)

    // Web Push Notifications
    app.get('/public/orders/vapid-public-key', async (_req, reply) => {
        return reply.send({ publicKey: VAPID_PUBLIC_KEY })
    })

    app.post('/public/orders/:id/push-subscription', async (request, reply) => {
        const { id } = request.params as { id: string }
        const { subscription } = request.body as { subscription: any }
        if (id && subscription) {
            webPushManager.registerSubscription(id, subscription)
            return reply.status(200).send({ message: 'Push subscription registered.' })
        }
        return reply.status(400).send({ message: 'Missing id or subscription.' })
    })

    app.patch('/api/pdv/orders/:id/status', updateOnlineOrderStatus)

    // DistribuiÃ§Ã£o, VinculaÃ§Ã£o e Auto-Update do Windy
    // ProntuÃ¡rio e HistÃ³rico PÃºblico de Equipamento
    app.get('/public/equipments/:id/history', getEquipmentHistory)
    app.get('/api/public/equipments/:id/history', getEquipmentHistory)
    app.get('/api/public/windy/clients-summary', getClientsSummaryForWindy)
    app.post('/api/public/windy/bind-device', bindDeviceFromWindy)
    app.get('/api/public/windy/tenant-by-code/:code', getTenantByCode)
    app.get('/api/public/windy/tenant-by-code', getTenantByCode)
    app.get('/api/tenants', getTenantByCode)
    app.get('/api/public/windy/latest', getLatestWindyVersion)
    app.get('/public/windy/latest', getLatestWindyVersion)
    app.get('/api/public/windy/download', downloadLatestWindy)
    app.get('/downloads/Metrics_Windy_Setup.exe', downloadLatestWindy)
    app.post('/api/admin/downloads/windy', uploadWindyRelease)

    // DistribuiÃ§Ã£o e Auto-Update do Metrics PDV
    app.get('/api/public/pdv/latest', getLatestPdvVersion)
    app.get('/public/pdv/latest', getLatestPdvVersion)
    app.get('/api/public/pdv/download', downloadLatestPdv)
    app.get('/downloads/Instalar_MetricsPDV.exe', downloadLatestPdv)
    app.post('/api/admin/downloads/pdv', uploadPdvRelease)

    app.get('/public/health', async (_, reply) => {
        return reply.status(200).send({ status: 'ok' })
    })
    
    // Catálogo Geral e Releases Unificadas de Todos os Apps Oficiais
    app.get('/api/public/apps-catalog', getAppsCatalog)
    app.get('/public/apps-catalog', getAppsCatalog)

    app.get('/api/public/:app/latest', getAppLatestVersion)
    app.get('/public/:app/latest', getAppLatestVersion)

    app.get('/api/public/:app/download', downloadApp)
    app.get('/public/:app/download', downloadApp)

    app.post('/api/admin/downloads/:app', uploadAppRelease)

    // Aliases diretos de arquivos
    app.get('/downloads/Metrics_Sync_Setup.exe', (req, rep) => downloadApp({ ...req, params: { app: 'sync' } } as any, rep))
    app.get('/downloads/Instalador-MetricsSync.exe', (req, rep) => downloadApp({ ...req, params: { app: 'sync' } } as any, rep))
    app.get('/downloads/Metrics_Ponto_Setup.exe', (req, rep) => downloadApp({ ...req, params: { app: 'ponto' } } as any, rep))
    app.get('/downloads/Instalador-MetricsPonto.exe', (req, rep) => downloadApp({ ...req, params: { app: 'ponto' } } as any, rep))
    app.get('/downloads/metrics-mobile.apk', (req, rep) => downloadApp({ ...req, params: { app: 'mobile' } } as any, rep))
    app.get('/downloads/metrics-garcom.apk', (req, rep) => downloadApp({ ...req, params: { app: 'garcom' } } as any, rep))
}
