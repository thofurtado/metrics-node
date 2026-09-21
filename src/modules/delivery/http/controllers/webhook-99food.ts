import { FastifyReply, FastifyRequest } from 'fastify'
import crypto from 'node:crypto'
import { resolveTenantForMerchant } from '../../services/delivery-tenant-resolver'
import { writeJournal } from '../../services/ifood-events.service'
import { sseManager } from '@/lib/sse-manager'
import { env } from '@/env'

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
  const startedAt = Date.now()
  // O corpo chega já convertido com IDs longos (64 bits) como TEXTO (ver routes.ts), e o texto cru é guardado
  // para conferir a assinatura e para o diário de eventos.
  const payload = request.body as any
  const rawBody: string = (request as any).rawBody ?? ''

  const headerType = String(payload?.type || payload?.event_type || payload?.action || 'UNKNOWN')

  // Assinatura: didi-header-sign = MD5(corpo cru + APP SECRET). Por ora só REGISTRAMOS o resultado (não rejeita),
  // até termos evidência real de que o cálculo bate com o que a 99Food envia.
  const signHeader = String(request.headers['didi-header-sign'] || '')
  let signStatus = 'sem_segredo_configurado'
  if (env.FOOD99_SECRET) {
    if (!signHeader) signStatus = 'cabecalho_ausente'
    else signStatus = crypto.createHash('md5').update(rawBody + env.FOOD99_SECRET, 'utf-8').digest('hex') === signHeader ? 'ok' : 'invalida'
  }

  console.log(`[99Food Webhook] Evento "${headerType}" recebido (assinatura: ${signStatus}, ${rawBody.length} bytes)`)

  // Diário de eventos (evidência): texto cru + cabeçalhos, sem perder os IDs longos.
  const journalOrderId = payload?.data?.order_id ?? payload?.data?.order_info?.order_id ?? null
  void writeJournal({
    method: 'EVENT99',
    endpoint: headerType,
    orderId: journalOrderId != null ? String(journalOrderId) : null,
    request: {
      signature: signStatus,
      app_id: payload?.app_id != null ? String(payload.app_id) : null,
      app_shop_id: payload?.app_shop_id != null ? String(payload.app_shop_id) : null,
      headers: {
        'user-agent': request.headers['user-agent'],
        'content-type': request.headers['content-type'],
        'didi-header-sign': signHeader || undefined,
        'x-request-id': request.headers['x-request-id'],
      },
      raw: rawBody.length > 60000 ? rawBody.slice(0, 60000) + '…[truncado]' : rawBody,
    },
    durationMs: Date.now() - startedAt,
    success: true,
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
    const eventType = headerType
    console.log(`[99Food Webhook] Evento "${eventType}" recebido para o tenant ${dbName}`)

    // 4. SÓ o evento orderNew cria pedido. orderConfirm/orderReady/orderCancel/orderFinish/orderCancelApply etc.
    // também trazem "order" no nome e antes criavam um pedido falso a cada notificação. Eventos sem "type"
    // (testes manuais antigos) continuam aceitos se trouxerem order_info.
    const isNewOrderEvent = eventType === 'orderNew' || (eventType === 'UNKNOWN' && Boolean(payload?.data?.order_info))
    if (!isNewOrderEvent) {
      console.log(`[99Food Webhook] Evento "${eventType}" registrado no diário; tratamento específico ainda não implementado.`)
    }

    if (isNewOrderEvent) {
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

      // A 99Food reenvia o webhook até receber errno 0: não criar o mesmo pedido duas vezes.
      const jaExiste = await (prisma as any).pedido.findFirst({
        where: { observacao: { contains: `[99Food] Pedido #${rawOrderId} ` } },
        select: { id: true },
      })
      if (jaExiste) {
        console.log(`[99Food Webhook] Pedido ${rawOrderId} já existe (id ${jaExiste.id}); ignorando reenvio.`)
        return reply.status(200).send({ errno: 0, errmsg: 'ok' })
      }

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
          observacao: `[99Food] Pedido #${rawOrderId} | Pagamento via 99Food${payload?.app_shop_id ? ` | [99Loja:${payload.app_shop_id}]` : ''}`,
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

    // Resposta esperada pela 99Food (doc "Webhook Responses"): errno 0. Sem isso ela reenvia várias vezes.
    return reply.status(200).send({ errno: 0, errmsg: 'ok' })
  } catch (err: any) {
    console.error('[99Food Webhook Error]:', err)
    void writeJournal({ method: 'EVENT99', endpoint: `${headerType}:erro`, request: { raw: rawBody.slice(0, 20000) }, success: false, error: err?.message || String(err), durationMs: Date.now() - startedAt })
    // errno diferente de 0 faz a 99Food reenviar (seguro: o pedido já é protegido contra duplicidade).
    return reply.status(200).send({ errno: 1, errmsg: 'internal error' })
  }
}
