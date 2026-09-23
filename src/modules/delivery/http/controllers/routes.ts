import { FastifyInstance } from 'fastify'
import { webhook99FoodController } from './webhook-99food'
import { webhookIfoodController } from './webhook-ifood'
import { verifyJwt } from '@/http/middlewares/verify-jwt'
import { parseJsonKeepingLongIds } from '@/lib/json-safe-ids'

import { ifoodCancelProbeController, ifoodDiagDataController, ifoodDiagPageController } from './ifood-diagnostic'
import {
  ifoodUserCodeController,
  ifoodExchangeTokenController,
  ifoodAuthorizationStatusController,
  deliveryStatusController,
  deliveryOrdersController,
  ifoodApiLogsController,
  ifoodCancellationStatusController,
  ifoodTestCancellationPatchController,
  pollIfoodNowController,

  syncCatalogController,
} from './ifood-controllers'
import {
  getPendingDeliveryItemMappings,
  createDeliveryItemMapping,
  listDeliveryItemMappings,
  deleteDeliveryItemMapping,
} from './delivery-item-mapping'

export async function deliveryRoutes(app: FastifyInstance) {
  // Webhooks de terceiros (Recebem chamadas automáticas da 99Food e iFood)
  // A 99Food usa IDs de 64 bits (loja, pedido, app). Neste contexto isolado o JSON é lido como texto: guardamos o
  // corpo cru (assinatura e diário) e convertemos os inteiros longos em texto para não perder precisão.
  await app.register(async (food99) => {
    food99.removeContentTypeParser('application/json')
    food99.addContentTypeParser('application/json', { parseAs: 'string' }, (request, body, done) => {
      ;(request as any).rawBody = body as string
      try {
        done(null, (body as string).length ? parseJsonKeepingLongIds(body as string) : {})
      } catch (err: any) {
        err.statusCode = 400
        done(err, undefined)
      }
    })
    food99.post('/webhooks/99food', webhook99FoodController)
    food99.post('/api/webhooks/99food', webhook99FoodController)
  })

  // Webhooks Oficiais iFood (homologacao Toqan e producao)
  app.post('/webhooks/ifood', webhookIfoodController)
  app.get('/webhooks/ifood', async (req, reply) => reply.status(200).send({ status: 'active', service: 'ifood-webhook' }))
  app.post('/api/webhooks/ifood', webhookIfoodController)
  app.get('/api/webhooks/ifood', async (req, reply) => reply.status(200).send({ status: 'active', service: 'ifood-webhook' }))
  app.post('/delivery/ifood/webhook', webhookIfoodController)
  app.get('/delivery/ifood/webhook', async (req, reply) => reply.status(200).send({ status: 'active', service: 'ifood-webhook' }))
  app.post('/api/delivery/ifood/webhook', webhookIfoodController)
  app.post('/webhooks/cancellation', webhookIfoodController)
  app.get('/webhooks/cancellation', async (req, reply) => reply.status(200).send({ status: 'active', service: 'ifood-cancellation' }))
  app.post('/api/webhooks/cancellation', webhookIfoodController)
  app.post('/order/v1.0/events', webhookIfoodController)
  app.post('/events', webhookIfoodController)
  app.get('/events', async (req, reply) => reply.status(200).send({ status: 'active', service: 'ifood-events' }))
  app.post('/api/events', webhookIfoodController)
  app.post('/ifood/events', webhookIfoodController)
  app.post('/api/ifood/events', webhookIfoodController)
  app.post('/webhooks/events', webhookIfoodController)
  app.post('/api/webhooks/events', webhookIfoodController)

  // Endpoints do iFood para autorização e status
  app.get('/delivery/ifood/usercode', ifoodUserCodeController)
  app.get('/api/delivery/ifood/usercode', ifoodUserCodeController)
  app.post('/delivery/ifood/token', { preHandler: verifyJwt }, ifoodExchangeTokenController)
  app.post('/api/delivery/ifood/token', { preHandler: verifyJwt }, ifoodExchangeTokenController)
  app.get('/delivery/ifood/authorization-status', ifoodAuthorizationStatusController)
  app.get('/api/delivery/ifood/authorization-status', ifoodAuthorizationStatusController)

  // Status e diagnóstico geral das integrações de delivery
  app.get('/delivery/status', deliveryStatusController)
  app.get('/api/delivery/status', deliveryStatusController)

    // Auditoria persistente das chamadas iFood (JWT ou x-api-key obrigatório)
    app.get('/delivery/ifood/api-logs', { preHandler: verifyJwt }, ifoodApiLogsController)
    app.get('/api/delivery/ifood/api-logs', { preHandler: verifyJwt }, ifoodApiLogsController)

    // Diagnóstico sanitizado: não expõe corpo, payload ou credenciais.
    app.get('/delivery/ifood/cancellation-status/:orderId', ifoodCancellationStatusController)

    // Acompanhamento ao vivo do cancelamento (só funciona com IFOOD_DIAG_KEY definida; a chave vai em ?key=)
    app.get('/delivery/ifood/diag', ifoodDiagPageController)
    app.get('/delivery/ifood/diag/data', ifoodDiagDataController)
    app.post('/delivery/ifood/diag/cancel-probe', ifoodCancelProbeController)
    app.get('/api/delivery/ifood/cancellation-status/:orderId', ifoodCancellationStatusController)

    app.post('/delivery/ifood/test-cancellation-patch', { preHandler: verifyJwt }, ifoodTestCancellationPatchController)
    app.post('/api/delivery/ifood/test-cancellation-patch', { preHandler: verifyJwt }, ifoodTestCancellationPatchController)

    // Consulta de pedidos de delivery salvos em db_restaurante



  app.get('/delivery/orders', deliveryOrdersController)
  app.get('/api/delivery/orders', deliveryOrdersController)

  // Polling manual do iFood (diagnóstico e testes)
  app.post('/delivery/ifood/poll-now', pollIfoodNowController)
  app.post('/api/delivery/ifood/poll-now', pollIfoodNowController)
  app.get('/delivery/ifood/poll-now', pollIfoodNowController)
  app.get('/api/delivery/ifood/poll-now', pollIfoodNowController)

  // Sincronização centralizada de cardápio com marketplaces
  app.post('/delivery/catalog/sync', syncCatalogController)
  app.post('/api/delivery/catalog/sync', syncCatalogController)
  app.get('/delivery/catalog/sync', syncCatalogController)
  app.get('/api/delivery/catalog/sync', syncCatalogController)

  // Vínculo de item de delivery (iFood/99Food) com produto do Metrics
  app.get('/delivery/item-mappings/pending', { preHandler: verifyJwt }, getPendingDeliveryItemMappings)
  app.get('/api/delivery/item-mappings/pending', { preHandler: verifyJwt }, getPendingDeliveryItemMappings)
  app.get('/delivery/item-mappings', { preHandler: verifyJwt }, listDeliveryItemMappings)
  app.get('/api/delivery/item-mappings', { preHandler: verifyJwt }, listDeliveryItemMappings)
  app.post('/delivery/item-mappings', { preHandler: verifyJwt }, createDeliveryItemMapping)
  app.post('/api/delivery/item-mappings', { preHandler: verifyJwt }, createDeliveryItemMapping)
  app.delete('/delivery/item-mappings/:id', { preHandler: verifyJwt }, deleteDeliveryItemMapping)
  app.delete('/api/delivery/item-mappings/:id', { preHandler: verifyJwt }, deleteDeliveryItemMapping)
}
