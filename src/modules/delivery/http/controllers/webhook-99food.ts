import { FastifyReply, FastifyRequest } from 'fastify'
import { resolveTenantForMerchant } from '../../services/delivery-tenant-resolver'

export interface DeliveryEventLog {
  id: string
  platform: 'FOOD99' | 'IFOOD'
  receivedAt: string
  headers: any
  body: any
}

// Buffer em memória para diagnóstico e acompanhamento em tempo real
export const recentDeliveryEvents: DeliveryEventLog[] = []

/**
 * Webhook Oficial 99Food: POST /webhooks/99food
 * Recebe notificações push de pedidos em tempo real diretamente dos servidores da 99Food.
 */
export async function webhook99FoodController(request: FastifyRequest, reply: FastifyReply) {
  const payload = request.body as any

  console.log('[99Food Webhook] Evento recebido com sucesso:', {
    headers: request.headers,
    body: payload,
  })

  // Registra no buffer de eventos recentes
  recentDeliveryEvents.unshift({
    id: String(Date.now()),
    platform: 'FOOD99',
    receivedAt: new Date().toISOString(),
    headers: {
      'user-agent': request.headers['user-agent'],
      'content-type': request.headers['content-type'],
    },
    body: payload,
  })

  if (recentDeliveryEvents.length > 30) {
    recentDeliveryEvents.pop()
  }

  try {
    // 1. Extrair ID da loja da 99Food
    const storeId = String(payload?.store_id || payload?.storeId || payload?.shop_id || payload?.shopId || '5764617543416810779')

    // 2. Descobrir a qual tenant pertence essa loja com total isolamento
    const { dbName, prisma } = await resolveTenantForMerchant(storeId, 'FOOD99')

    // 3. Processar tipo de evento (Novo Pedido, Cancelamento, etc.)
    const eventType = payload?.event_type || payload?.type || payload?.action || 'UNKNOWN'
    console.log(`[99Food Webhook] Evento ${eventType} recebido para o tenant ${dbName}`)

    // A 99Food exige retorno 200 OK com código de sucesso imediato: { code: 0, message: "success" }
    return reply.status(200).send({
      code: 0,
      message: 'success',
    })
  } catch (err: any) {
    console.error('[99Food Webhook Error]:', err)
    return reply.status(200).send({
      code: 0,
      message: 'handled with warnings',
    })
  }
}
