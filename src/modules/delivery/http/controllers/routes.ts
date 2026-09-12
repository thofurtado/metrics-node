import { FastifyInstance } from 'fastify'
import { webhook99FoodController } from './webhook-99food'
import { ifoodUserCodeController, deliveryStatusController } from './ifood-controllers'

export async function deliveryRoutes(app: FastifyInstance) {
  // Webhooks de terceiros (Recebem chamadas automáticas da 99Food e iFood)
  app.post('/webhooks/99food', webhook99FoodController)
  app.post('/api/webhooks/99food', webhook99FoodController)

  // Endpoints do iFood para autorização e status
  app.get('/delivery/ifood/usercode', ifoodUserCodeController)
  app.get('/api/delivery/ifood/usercode', ifoodUserCodeController)

  // Status e diagnóstico geral das integrações de delivery
  app.get('/delivery/status', deliveryStatusController)
  app.get('/api/delivery/status', deliveryStatusController)
}
