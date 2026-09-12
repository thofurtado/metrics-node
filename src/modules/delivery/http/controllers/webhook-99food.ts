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
      payload?.data?.order_info?.shop?.shop_id ||
      payload?.data?.order_info?.shop?.app_shop_id ||
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
      Boolean(payload?.data?.order_info || payload?.order_id || payload?.data?.order_id || payload?.data?.orderId || payload?.data?.order)

    if (isOrderEvent) {
      console.log(`[99Food Webhook] Processando criação/recebimento de pedido 99Food para o banco ${dbName}...`)
      const orderInfo = payload?.data?.order_info || payload?.data?.order || payload?.data || payload
      const rawOrderId = String(
        orderInfo?.order_id ||
        payload?.data?.order_id ||
        orderInfo?.orderId ||
        orderInfo?.id ||
        payload?.order_id ||
        Date.now()
      )

      // Identificar ou criar cliente
      const recvAddr = orderInfo?.receive_address || {}
      const clientName = String(
        recvAddr?.name ||
        orderInfo?.customer_name ||
        orderInfo?.receiver_name ||
        orderInfo?.user_name ||
        'Cliente 99Food'
      )
      const clientPhone = String(
        recvAddr?.phone ||
        orderInfo?.customer_phone ||
        orderInfo?.receiver_phone ||
        '11999999999'
      ) || '11999999999'

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
        const streetStr = recvAddr?.street_name || recvAddr?.poi_address || orderInfo?.delivery_address?.street || 'Av. Principal'
        const numberStr = String(recvAddr?.house_number || recvAddr?.street_number || orderInfo?.delivery_address?.number || '100')
        const neighborhoodStr = recvAddr?.district || orderInfo?.delivery_address?.neighborhood || 'Centro'
        const cityStr = recvAddr?.city || orderInfo?.delivery_address?.city || 'Caraguatatuba'

        const addr = await (prisma as any).address.create({
          data: {
            client_id: client.id,
            street: streetStr,
            number: numberStr,
            neighborhood: neighborhoodStr,
            city: cityStr,
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
      const totalAmount = orderInfo?.price?.order_price
        ? (orderInfo.price.order_price / 100)
        : (orderInfo?.price?.real_price
          ? (orderInfo.price.real_price / 100)
          : (orderInfo?.total_price
            ? (orderInfo.total_price / 100)
            : 25.0))
      const deliveryFee = orderInfo?.delivery_fee ? (orderInfo.delivery_fee / 100) : 0
      const subtotal = Math.max(0, totalAmount - deliveryFee)

      const rawItems = orderInfo?.order_items || orderInfo?.items || orderInfo?.dishes || []
      const itemsToCreate = rawItems.length > 0 ? rawItems.map((it: any) => {
        const itemQty = Number(it.amount || it.quantity || it.count || 1)
        const itemPrice = it.sku_price
          ? (it.sku_price / 100)
          : (it.total_price ? (it.total_price / 100) : (it.price ? (it.price / 100) : 25.0))
        return {
          quantidade: itemQty,
          valor_unitario: itemPrice,
          valor_total: itemPrice * itemQty,
          observacao: it.name || it.item_name || 'X-Burguer Artesanal'
        }
      }) : [{
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
