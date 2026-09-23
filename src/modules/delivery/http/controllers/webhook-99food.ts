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

      // ── Dados reais do pedido (estrutura do orderNew = Get Order Details). Nada é inventado: o que não vier
      // fica vazio/nulo, e o PDV mostra "não informado".
      const centavos = (v: any): number => (v == null || v === '' || Number.isNaN(Number(v)) ? 0 : Number(v) / 100)
      const texto = (v: any): string => (v == null ? '' : String(v).trim())

      const recvAddr = orderInfo?.receive_address || {}
      const isPickup = Number(orderInfo?.fulfillment_mode) === 1
      const deliveryType = Number(orderInfo?.delivery_type) // 0 retirada, 1 entrega 99Food, 2 entrega da loja
      const payMethod = Number(orderInfo?.pay_method) // 1 online, 2 na entrega
      const price = orderInfo?.price || {}

      const clientName =
        texto(recvAddr.name) ||
        [texto(recvAddr.first_name), texto(recvAddr.last_name)].filter(Boolean).join(' ') ||
        'Cliente 99Food'
      const clientPhone = texto(recvAddr.virtual_phone_number) || texto(recvAddr.phone) || null

      let client = clientPhone
        ? await (prisma as any).client.findFirst({ where: { phone: clientPhone }, include: { addresses: true } })
        : await (prisma as any).client.findFirst({ where: { phone: null, name: clientName }, include: { addresses: true } })

      if (!client) {
        client = await (prisma as any).client.create({
          data: { name: clientName, phone: clientPhone },
          include: { addresses: true },
        })
      }

      // Endereço: só cria se a 99Food mandou rua/endereço (retirada e o mock do Sandbox vêm sem).
      const street = texto(recvAddr.street_name) || texto(recvAddr.poi_address)
      let targetAddressId: string | null = null
      if (!isPickup && street) {
        const addr = await (prisma as any).address.create({
          data: {
            client_id: client.id,
            street,
            number: texto(recvAddr.house_number) || texto(recvAddr.street_number) || 'S/N',
            neighborhood: texto(recvAddr.district) || '',
            city: texto(recvAddr.city) || '',
            state: texto(recvAddr.state) || '',
            zipcode: texto(recvAddr.postal_code || recvAddr.postalCode) || undefined,
            complement: texto(recvAddr.complement) || undefined,
            is_main: false,
          },
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

      // Valores (centavos). Total = o que a loja recebe (real_price nos modelos 2/3; order_price no modelo 1).
      // A taxa de entrega só é da loja quando a entrega é da própria loja (delivery_type 2).
      const orderPrice = centavos(price.order_price)
      const totalAmount = price.real_price != null ? centavos(price.real_price) : orderPrice
      const deliveryFee = deliveryType === 2 ? centavos(price.delivery_price) : 0
      const subtotal = Math.max(0, totalAmount - deliveryFee)

      // Itens: liga ao produto pelo app_item_id (é o id do produto enviado no cardápio); senão, pelo nome.
      const rawItems: any[] = orderInfo?.order_items || []
      const itemsToCreate: any[] = []
      for (const it of rawItems) {
        const itemName = texto(it.name) || 'Item 99Food'
        const appItemId = texto(it.app_item_id)

        // Vínculo manual tem prioridade: cobre o caso raro de o produto ter sido apagado/recriado
        // com outro ID depois que o cardápio já foi enviado pro 99Food.
        let matchedProduct: any = null
        if (appItemId) {
          const mapping = await (prisma as any).deliveryItemMapping.findUnique({
            where: { platform_external_code: { platform: '99FOOD', external_code: appItemId } },
          })
          if (mapping) {
            matchedProduct = await (prisma as any).product.findUnique({ where: { id: mapping.product_id } })
          }
        }
        if (!matchedProduct && appItemId) {
          matchedProduct = await (prisma as any).product.findFirst({ where: { OR: [{ id: appItemId }, { barcode: appItemId }] } })
        }
        if (!matchedProduct) {
          matchedProduct = await (prisma as any).product.findFirst({ where: { name: { equals: itemName, mode: 'insensitive' } } })
        }

        const qty = Number(it.amount || 1) || 1
        const unit = it.sku_price != null ? centavos(it.sku_price) : centavos(it.total_price) / qty

        let obs = itemName
        const subs: any[] = Array.isArray(it.sub_item_list) ? it.sub_item_list : []
        if (subs.length > 0) {
          obs += ` [Adicionais: ${subs.map((o: any) => `${texto(o.name) || 'Opção'} (x${Number(o.amount || 1)})`).join(', ')}]`
        }
        if (texto(it.remark)) obs += ` (Obs: ${texto(it.remark)})`

        itemsToCreate.push({
          produto_id: matchedProduct ? matchedProduct.id : undefined,
          quantidade: qty,
          valor_unitario: unit,
          valor_total: it.total_price != null ? centavos(it.total_price) : unit * qty,
          observacao: obs,
          external_code: appItemId || null,
          external_name: itemName,
        })
      }
      if (itemsToCreate.length === 0) {
        itemsToCreate.push({ quantidade: 1, valor_unitario: totalAmount, valor_total: totalAmount, observacao: 'Pedido 99Food (itens não informados)' })
      }

      // Pagamento: a marca de texto abaixo é o que o PDV lê. Online = já pago; offline = cobrar na entrega.
      const changeFor = centavos(orderInfo?.change_for)
      let pagamentoTxt = 'Forma de pagamento não informada'
      if (payMethod === 1) pagamentoTxt = 'Pagamento via 99Food'
      else if (payMethod === 2) pagamentoTxt = `Pagar na entrega (dinheiro)${changeFor > 0 ? ` | troco para ${changeFor.toFixed(2).replace('.', ',')}` : ''}`
      const entregaTxt = isPickup ? 'Retirada' : deliveryType === 2 ? 'Entrega própria' : deliveryType === 1 ? 'Entrega 99Food' : ''
      const indexTxt = orderInfo?.order_index != null ? ` | Nº ${orderInfo.order_index}` : ''

      // Criar Pedido canônico no banco do tenant
      const pedido = await (prisma as any).pedido.create({
        data: {
          display_id: displayId,
          numero_diario: displayId,
          origem: 'Delivery',
          plataforma: '99FOOD',
          caixa_id: activeCashier?.id || null,
          cliente_id: client.id,
          endereco_entrega_id: targetAddressId,
          subtotal: subtotal,
          valor_frete: deliveryFee,
          valor_final: totalAmount,
          valor_troco: payMethod === 2 && changeFor > totalAmount ? changeFor - totalAmount : 0,
          status: 'Aberto',
          status_delivery: 'Pendente',
          observacao: `[99Food] Pedido #${rawOrderId} | ${pagamentoTxt}${indexTxt}${entregaTxt ? ` | ${entregaTxt}` : ''}${payload?.app_shop_id ? ` | [99Loja:${payload.app_shop_id}]` : ''}`,
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
        const addrText = street
          ? `${street}${texto(recvAddr.house_number) ? ', ' + texto(recvAddr.house_number) : ''}${texto(recvAddr.district) ? ' - ' + texto(recvAddr.district) : ''}`
          : ''
        const fullOrderDto = {
          id: pedido.uuid,
          order_id: pedido.uuid,
          display_id: pedido.display_id,
          client_name: client.name,
          client_phone: client.phone || '',
          address: addrText,
          neighborhood: texto(recvAddr.district),
          city: texto(recvAddr.city),
          total_amount: pedido.valor_final,
          delivery_fee: pedido.valor_frete,
          observations: pedido.observacao || '',
          created_at: pedido.data_abertura,
          items: (pedido.itens || []).map((i: any) => ({
            id: i.uuid,
            product_id: i.produto_id || undefined,
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
