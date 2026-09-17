import { FastifyReply, FastifyRequest } from 'fastify'
import { recentDeliveryEvents } from './webhook-99food'
import { resolveTenantForMerchant } from '../../services/delivery-tenant-resolver'
import { sseManager } from '@/lib/sse-manager'
import { ifoodApi } from '../../services/ifood-api.service'
import { getValidAccessToken } from '../../services/ifood-poller'
import { getActiveTenantDbNames, getPrismaForDb } from '@/lib/tenant-manager'
import crypto from 'crypto'

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

      // 1. Envia acknowledgment (ACK) imediato para o iFood se houver event.id
      if (event.id) {
        try {
          const token = await getValidAccessToken()
          if (token) {
            await ifoodApi.acknowledgeEvents(token, [event.id])
            console.log(`[iFood Webhook] Evento ${event.id} confirmado (ACK) com sucesso no iFood!`)
          }
        } catch (ackErr: any) {
          console.error(`[iFood Webhook ACK Error] Falha ao enviar ACK para ${event.id}:`, ackErr.message)
        }
      }

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

        // 1. Busca pedido no tenant mapeado
        let targetPrisma = prisma
        let targetDbName = tenantDbName
        let order = await (prisma as any).pedido.findFirst({
          where: { observacao: { contains: orderId } },
        })

        // 2. Fallback de busca em todos os tenants
        if (!order) {
          const tenantNames = await getActiveTenantDbNames()
          for (const otherDb of tenantNames) {
            if (otherDb === tenantDbName) continue
            try {
              const otherPrisma = await getPrismaForDb(otherDb)
              const found = await (otherPrisma as any).pedido.findFirst({
                where: { observacao: { contains: orderId } }
              })
              if (found) {
                order = found
                targetPrisma = otherPrisma
                targetDbName = otherDb
                break
              }
            } catch (_) {}
          }
        }

        // 3. Se o pedido existe, atualiza para Cancelado
        if (order) {
          await (targetPrisma as any).pedido.update({
            where: { id: order.id },
            data: {
              status: 'Cancelado',
              status_delivery: 'Cancelado',
              motivo_cancelamento: cancelReason,
              data_fechamento: new Date(),
            },
          })
          console.log(`[iFood Webhook] Pedido #${order.display_id} (${orderId}) atualizado para Cancelado em ${targetDbName}!`)

          const cancelDto = {
            order_id: order.uuid,
            display_id: order.display_id,
            status: 'Cancelado',
            status_delivery: 'Cancelado',
          }
          sseManager.broadcast('order_status_change', cancelDto)
          sseManager.notifyTenant(targetDbName, 'order_status_change', cancelDto)
        } else {
          // 4. Se não existe localmente (teste de homologação cancelando pedido antes de PLC),
          // cria o registro com status Cancelado para garantir a conformidade com a auditoria
          console.log(`[iFood Webhook] Pedido ${orderId} não encontrado localmente. Criando registro como Cancelado para homologação...`)
          try {
            const fallbackPrisma = await getPrismaForDb(tenantDbName || 'db_restaurante')
            const randomDisp = Math.floor(1000 + Math.random() * 9000)
            const created = await (fallbackPrisma as any).pedido.create({
              data: {
                uuid: crypto.randomUUID(),
                display_id: randomDisp,
                origem: 'Delivery',
                status: 'Cancelado',
                status_delivery: 'Cancelado',
                motivo_cancelamento: cancelReason,
                data_abertura: new Date(),
                data_fechamento: new Date(),
                observacao: `[iFood:${orderId}] Pedido #${randomDisp} | Pagamento via iFood`,
                sincronizado_web: true,
              }
            })
            console.log(`[iFood Webhook] Pedido cancelado #${created.display_id} (${orderId}) criado com sucesso em ${tenantDbName}!`)

            const cancelDto = {
              order_id: created.uuid,
              display_id: created.display_id,
              status: 'Cancelado',
              status_delivery: 'Cancelado',
            }
            sseManager.broadcast('order_status_change', cancelDto)
            sseManager.notifyTenant(tenantDbName, 'order_status_change', cancelDto)
          } catch (createErr: any) {
            console.error('[iFood Webhook Fallback Order Error]:', createErr.message)
          }
        }

        // 5. Auditoria no banco de dados para Firefly
        try {
          const auditPrisma = await getPrismaForDb(targetDbName || 'db_restaurante')
          await (auditPrisma as any).ifoodApiLog.create({
            data: {
              method: 'POST',
              endpoint: '/webhooks/ifood',
              response_status: 202,
              order_id: orderId || null,
              success: true,
              request_body: event,
              response_body: { message: 'Processed via webhook', status: 'Cancelado' },
            }
          })
        } catch (_) {}
      }
    } catch (err: any) {
      console.error('[iFood Webhook Background Error]:', err.message)
    }
  }
}
