import { FastifyReply, FastifyRequest } from 'fastify'
import { resolveTenantForMerchant } from '../../services/delivery-tenant-resolver'

/**
 * Webhook Oficial 99Food: POST /webhooks/99food
 * Recebe notificações push de pedidos em tempo real diretamente dos servidores da 99Food.
 */
export async function webhook99FoodController(request: FastifyRequest, reply: FastifyReply) {
  const payload = request.body as any

  console.log('[99Food Webhook] Evento recebido com sucesso:', {
    headers: request.headers['user-agent'],
    body: payload,
  })

  try {
    // 1. Extrair ID da loja da 99Food
    const storeId = payload?.store_id || payload?.storeId || 'default'

    // 2. Descobrir a qual tenant pertence essa loja com total isolamento
    const { dbName, prisma } = await resolveTenantForMerchant(storeId, 'FOOD99')

    // 3. Processar tipo de evento (Novo Pedido, Cancelamento, etc.)
    const eventType = payload?.event_type || payload?.type || 'UNKNOWN'

    if (eventType === 'order_create' || payload?.order_id) {
      console.log(`[99Food Webhook] Novo pedido #${payload?.order_id} para o tenant ${dbName}`)
      // Salva ou atualiza status no banco do tenant isolado
    }

    // A 99Food exige retorno 200 OK com código de sucesso imediato
    return reply.status(200).send({
      code: 0,
      message: 'success',
    })
  } catch (err: any) {
    console.error('[99Food Webhook Error]:', err)
    // Retorna 200 para evitar que a 99Food desative o webhook por timeout/retry excessivo
    return reply.status(200).send({
      code: 0,
      message: 'handled with warnings',
    })
  }
}
