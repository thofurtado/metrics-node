import { FastifyInstance } from 'fastify'
import { webhook99FoodController } from './webhook-99food'
import { webhookIfoodController } from './webhook-ifood'
import { verifyJwt } from '@/http/middlewares/verify-jwt'

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

export async function deliveryRoutes(app: FastifyInstance) {
  // Webhooks de terceiros (Recebem chamadas automáticas da 99Food e iFood)
  app.post('/webhooks/99food', webhook99FoodController)
  app.post('/api/webhooks/99food', webhook99FoodController)

  // Webhooks Oficiais iFood (homologacao Toqan e producao)
  app.post('/webhooks/ifood', webhookIfoodController)
  app.post('/api/webhooks/ifood', webhookIfoodController)
  app.post('/delivery/ifood/webhook', webhookIfoodController)
  app.post('/api/delivery/ifood/webhook', webhookIfoodController)
  app.post('/webhooks/cancellation', webhookIfoodController)
  app.post('/api/webhooks/cancellation', webhookIfoodController)

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
}
