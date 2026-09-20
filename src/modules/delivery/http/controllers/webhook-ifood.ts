import { FastifyReply, FastifyRequest } from 'fastify'
import { recentDeliveryEvents } from './webhook-99food'
import { resolveTenantForMerchant } from '../../services/delivery-tenant-resolver'
import { getValidAccessToken } from '../../services/ifood-poller'
import { isCancellationRelatedEvent, journalEvent, processCancellationEvent } from '../../services/ifood-events.service'

/**
 * Webhook do iFood (POST /webhooks/ifood e rotas variantes).
 * No webhook o "ACK" é a própria resposta HTTP 202, que sai imediatamente. Não se chama /acknowledgment aqui
 * (isso é do polling e o poller já confirma os mesmos eventos).
 * Os eventos de cancelamento passam pelo MESMO tratamento do polling (ifood-events.service).
 */
export async function webhookIfoodController(request: FastifyRequest, reply: FastifyReply) {
  const startedAt = Date.now()
  const body = request.body as any
  const events = Array.isArray(body) ? body : body ? [body] : []

  console.log(`[iFood Webhook] Recebida notificacao com ${events.length} evento(s):`, JSON.stringify(body))

  for (const event of events) {
    recentDeliveryEvents.unshift({
      id: String(event.id || Date.now()),
      platform: 'IFOOD',
      receivedAt: new Date().toISOString(),
      headers: {
        'user-agent': request.headers['user-agent'],
        'content-type': request.headers['content-type'],
        source: 'ifood-webhook',
      },
      body: event,
    })
    if (recentDeliveryEvents.length > 30) recentDeliveryEvents.pop()
  }

  // Resposta imediata (SLA do webhook).
  reply.status(202).send({ message: 'Events accepted' })
  const ackMs = Date.now() - startedAt

  for (const event of events) {
    let outcome = 'evento informativo (sem ação)'
    let success = true
    try {
      if (isCancellationRelatedEvent(event)) {
        let token: string | undefined
        try {
          const merchantId = String(event.merchantId || event.merchant_id || '4107174')
          const { dbName } = await resolveTenantForMerchant(merchantId, 'IFOOD')
          token = (await getValidAccessToken(dbName)) || undefined
        } catch (_) {}
        outcome = await processCancellationEvent(event, token, 'webhook')
        console.log(`[iFood Webhook] ${event.code || event.fullCode} (${event.orderId}): ${outcome}`)
      }
    } catch (err: any) {
      success = false
      outcome = `erro: ${err?.message || err}`
      console.error('[iFood Webhook Background Error]:', err?.message || err)
    }
    void journalEvent(event, 'webhook', { ackMs, outcome, success })
  }
}
