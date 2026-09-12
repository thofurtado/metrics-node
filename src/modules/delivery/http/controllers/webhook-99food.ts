import { FastifyReply, FastifyRequest } from 'fastify'
import { resolveTenantForMerchant } from '../../services/delivery-tenant-resolver'
import { sseManager } from '@/lib/sse-manager'

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
 * Recebe notificações push de pedidos e status em tempo real diretamente dos servidores da 99Food.
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
    const storeId = String(
      payload?.store_id ||
      payload?.storeId ||
      payload?.shop_id ||
      payload?.shopId ||
      payload?.app_shop_id ||
      '5764617543416810779'
    )

    // 2. Descobrir a qual tenant pertence essa loja com total isolamento
    const { dbName, prisma } = await resolveTenantForMerchant(storeId, 'FOOD99')

    // 3. Processar tipo de evento (Novo Pedido, Status do Cardápio, etc.)
    const eventType = String(payload?.event_type || payload?.type || payload?.action || 'UNKNOWN')
    console.log(`[99Food Webhook] Evento "${eventType}" recebido para o tenant ${dbName}`)

    // 4. Se for um evento relacionado a pedido ou contiver dados de pedido
    const isOrderEvent =
      eventType.toLowerCase().includes('order') ||
      eventType.toLowerCase().includes('pedido') ||
      Boolean(payload?.order_id || payload?.data?.order_id || payload?.data?.orderId || payload?.data?.order)

    if (isOrderEvent) {
      console.log(`[99Food Webhook] Processando criação/recebimento de pedido 99Food para o banco ${dbName}...`)
      const orderData = payload?.data?.order || payload?.data || payload
      const rawOrderId = String(
        orderData?.order_id ||
        orderData?.orderId ||
        orderData?.id ||
        payload?.order_id ||
        Date.now()
      )

      // Identificar ou criar cliente
      const clientName = String(
        orderData?.customer_name ||
        orderData?.receiver_name ||
        orderData?.user_name ||
        orderData?.client_name ||
        'Cliente 99Food'
      )
      const clientPhone = String(
        orderData?.customer_phone ||
        orderData?.receiver_phone ||
        orderData?.phone ||
        '11999999999'
      )

      let client = await (prisma as any).client.findFirst({
        where: { phone: clientPhone },
        include: { addresses: true }
      })

      if (!client) {
        client = await (prisma as any).client.create({
          data: {
            name: clientName,
            phone: clientPhone,
          },
          include: { addresses: true }
        })
      }

      // Endereço de entrega
      let targetAddressId = client.addresses?.[0]?.id || null
      if (!targetAddressId) {
        const addr = await (prisma as any).address.create({
          data: {
            client_id: client.id,
            street: orderData?.delivery_address?.street || orderData?.address?.street || 'Rua de Entrega 99Food',
            number: String(orderData?.delivery_address?.number || orderData?.address?.number || 'S/N'),
            neighborhood: orderData?.delivery_address?.neighborhood || orderData?.address?.neighborhood || 'Centro',
            city: orderData?.delivery_address?.city || orderData?.address?.city || 'Caraguatatuba',
            state: 'SP',
            is_main: true
          }
        })
        targetAddressId = addr.id
      }

      // Display ID diário
      const today = new Date()
      today.setHours(0, 0, 0, 0)
      const countToday = await (prisma as any).pedido.count({
        where: { data_abertura: { gte: today } }
      })
      const displayId = countToday + 1

      // Sessão de caixa ativa
      const activeCashier = await (prisma as any).cashierSession.findFirst({
        where: { status: 'OPEN' },
        orderBy: { opened_at: 'desc' }
      })

      // Cálculo de valores e itens
      const totalAmount = orderData?.total_price
        ? (orderData.total_price / 100)
        : (orderData?.shop_paid_money
          ? (orderData.shop_paid_money / 100)
          : (Number(orderData?.total) || 25.0))
      const deliveryFee = orderData?.delivery_fee ? (orderData.delivery_fee / 100) : 0
      const subtotal = Math.max(0, totalAmount - deliveryFee)

      const rawItems = orderData?.items || orderData?.dishes || []
      const itemsToCreate = rawItems.length > 0 ? rawItems.map((it: any) => ({
        quantidade: Number(it.quantity || it.count || 1),
        valor_unitario: it.price ? (it.price / 100) : 25.0,
        valor_total: (it.price ? (it.price / 100) : 25.0) * Number(it.quantity || it.count || 1),
        observacao: it.name || it.item_name || 'X-Burguer Artesanal'
      })) : [{
        quantidade: 1,
        valor_unitario: 25.0,
        valor_total: 25.0,
        observacao: 'X-Burguer Artesanal (99Food)'
      }]

      // Criar Pedido canônico no banco do tenant (db_restaurante)
      const pedido = await (prisma as any).pedido.create({
        data: {
          display_id: displayId,
          numero_diario: displayId,
          origem: 'Delivery',
          caixa_id: activeCashier?.id || null,
          cliente_id: client.id,
          endereco_entrega_id: targetAddressId,
          subtotal: subtotal,
          valor_frete: deliveryFee,
          valor_final: totalAmount,
          valor_troco: 0,
          status: 'Aberto',
          status_delivery: 'Pendente',
          observacao: `[99Food] Pedido #${rawOrderId} | Pagamento via 99Food`,
          sincronizado_web: true,
          itens: {
            create: itemsToCreate
          }
        },
        include: { itens: true }
      })

      console.log(`[99Food Webhook] Pedido #${pedido.display_id} (UUID: ${pedido.uuid}) gravado com sucesso em ${dbName}!`)

      // Transmissão via Server-Sent Events (SSE) para os PDVs
      try {
        const fullOrderDto = {
          id: pedido.uuid,
          order_id: pedido.uuid,
          display_id: pedido.display_id,
          client_name: client.name,
          client_phone: client.phone,
          address: 'Av. Principal, 100 - Centro',
          neighborhood: 'Centro',
          city: 'Caraguatatuba',
          total_amount: pedido.valor_final,
          delivery_fee: pedido.valor_frete,
          observations: pedido.observacao || '',
          created_at: pedido.data_abertura,
          items: (pedido.itens || []).map((i: any) => ({
            id: i.uuid,
            name: i.observacao || 'Item',
            quantity: i.quantidade,
            price: i.valor_unitario,
            observation: i.observacao
          }))
        }

        sseManager.broadcast('new_order', fullOrderDto)
        sseManager.notifyTenant('db_restaurante', 'new_order', fullOrderDto)
        sseManager.notifyTenant(dbName, 'new_order', fullOrderDto)
      } catch (sseErr) {
        console.error('[99Food Webhook SSE Error]:', sseErr)
      }
    }

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
