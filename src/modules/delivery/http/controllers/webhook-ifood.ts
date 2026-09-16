import { FastifyReply, FastifyRequest } from 'fastify'
import { recentDeliveryEvents } from './webhook-99food'
import { resolveTenantForMerchant } from '../../services/delivery-tenant-resolver'
import { sseManager } from '@/lib/sse-manager'
import { ifoodApi } from '../../services/ifood-api.service'
import { getValidAccessToken } from '../../services/ifood-poller'

/**
 * Webhook Oficial do iFood: POST /webhooks/ifood (e rotas variantes)
 * Recebe notificações push de eventos em tempo real diretamente dos servidores ou homologador do iFood.
 * Responde 202 Accepted imediatamente dentro do SLA exigido (< 2 segundos).
 */
export async function webhookIfoodController(request: FastifyRequest, reply: FastifyReply) {
  const body = request.body as any
  const events = Array.isArray(body) ? body : (body ? [body] : [])

  console.log(`[iFood Webhook] Recebida notificacao com ${events.length} evento(s):`, JSON.stringify(body))

  // Registra no buffer de eventos recentes em memoria
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

    if (recentDeliveryEvents.length > 30) {
      recentDeliveryEvents.pop()
    }
  }

  // Responde imediatamente com 202 Accepted para cumprir o SLA do webhook do iFood
  reply.status(202).send({ message: 'Events accepted' })

  // Processa os eventos em background de forma assincrona
  for (const event of events) {
    try {
      const codeStr = String(event.code || '').toUpperCase()
      const fullCodeStr = String(event.fullCode || '').toUpperCase()
      const orderId = String(event.orderId || event.order_id || '')

      const isDispute =
        codeStr === 'HSD' ||
        fullCodeStr === 'HANDSHAKE_DISPUTE' ||
        Boolean(event.metadata?.disputeId || event.disputeId)

      const isCancellation =
        codeStr === 'CAN' ||
        codeStr === 'CAR' ||
        codeStr === 'CCR' ||
        codeStr === 'CPR' ||
        codeStr === 'CANCELLED' ||
        codeStr === 'CANCELLATION' ||
        codeStr === 'CANCELADO' ||
        fullCodeStr === 'CANCELLED' ||
        fullCodeStr === 'CANCELLATION' ||
        fullCodeStr === 'CANCELLATION_REQUESTED' ||
        fullCodeStr === 'CONSUMER_CANCELLATION_REQUESTED' ||
        codeStr.includes('CANCEL') ||
        fullCodeStr.includes('CANCEL') ||
        isDispute

      if (isCancellation && orderId) {
        console.log(`[iFood Webhook] Processando evento de cancelamento (${codeStr}/${fullCodeStr}) para pedido ${orderId}...`)

        // Se houver disputa, aceita automaticamente
        const disputeId = String(event.metadata?.disputeId || event.disputeId || '')
        if (disputeId) {
          try {
            const token = await getValidAccessToken()
            if (token) {
              await ifoodApi.acceptDispute(token, disputeId)
              console.log(`[iFood Webhook] Disputa ${disputeId} aceita com sucesso via Webhook!`)
            }
          } catch (dErr: any) {
            console.log('[iFood Webhook] Aviso acceptDispute:', dErr.message)
          }
        }

        const cancelReason = String(
          event.metadata?.reason ||
          event.metadata?.details ||
          event.metadata?.CANCEL_REASON ||
          'Cancelamento confirmado via integracao'
        )

        const merchantId = String(event.merchantId || event.merchant_id || '4107174')
        const { dbName: tenantDbName, prisma } = await resolveTenantForMerchant(merchantId, 'IFOOD')

        const order = await (prisma as any).pedido.findFirst({
          where: { observacao: { contains: orderId } },
        })

        if (order) {
          await (prisma as any).pedido.update({
            where: { id: order.id },
            data: {
              status: 'Cancelado',
              status_delivery: 'Cancelado',
              motivo_cancelamento: cancelReason,
              data_fechamento: new Date(),
            },
          })
          console.log(`[iFood Webhook] Pedido #${order.display_id} (${orderId}) atualizado para Cancelado em ${tenantDbName}!`)

          const cancelDto = {
            order_id: order.uuid,
            display_id: order.display_id,
            status: 'Cancelado',
            status_delivery: 'Cancelado',
          }
          sseManager.broadcast('order_status_change', cancelDto)
          sseManager.notifyTenant(tenantDbName, 'order_status_change', cancelDto)
        }
      }
    } catch (err: any) {
      console.error('[iFood Webhook Background Error]:', err.message)
    }
  }
}
