import crypto from 'crypto'
import { ifoodApi } from './ifood-api.service'
import { sseManager } from '@/lib/sse-manager'
import { getActiveTenantDbNames, getPrismaForDb } from '@/lib/tenant-manager'
import { recentDeliveryEvents } from '../http/controllers/webhook-99food'
import { isCancellationRelatedEvent, journalEvent, processCancellationEvent } from './ifood-events.service'
import { intervaloDoDiaOperacional } from '@/lib/dia-operacional'
import { contatoDoClienteIfood, documentoDoCliente, enderecoDaEntregaIfood, mesmoEndereco, observacaoDoPedidoIfood } from './ifood-nota'
import { codigoCurtoDoProduto, eanDoItemIfood, valoresDoItemIfood } from './ifood-itens'
import { avancaSituacao, situacaoDoEvento, situacaoFinalPorPedido } from './ifood-situacao'
import { montarPedidosOnline } from '@/modules/public/http/controllers/pedido-online-dto'
import { eventoDeCancelado, FilaDePedidosNovos, MAX_TENTATIVAS_PEDIDO_NOVO, pedidosQueFalharam, situacaoMaisAdiantada } from './ifood-fila-pedidos'
import { localizarTenantDaLoja } from './delivery-tenant-resolver'
import { produtoUnicoPeloNome } from './produto-por-nome'
import { gravarValoresDaPlataforma, valoresDoPedidoIfood } from './valores-da-plataforma'

interface TokenStore {
  accessToken: string
  refreshToken: string
  expiresAt: number
}

// Tokens são carregados somente após a autorização OAuth do lojista.
// Nunca mantenha tokens reais versionados no código-fonte.
export let tokenState: TokenStore = {
  accessToken: '',
  refreshToken: '',
  expiresAt: 0,
}

const tokenStates = new Map<string, TokenStore>()
const DEFAULT_TENANT = 'db_restaurante'

// Homologação iFood: o ACK sai imediatamente após o polling e o mesmo evento pode chegar mais de uma vez.
// Ids já vistos são descartados; pedidos novos (PLC) que falharem entram na fila de nova tentativa da loja (ifood-fila-pedidos.ts).
const processedEventIds = new Set<string>()
const MAX_TRACKED_EVENT_IDS = 5000
const filaDePedidosNovos = new FilaDePedidosNovos()

function markEventProcessed(eventId: string) {
  processedEventIds.add(eventId)
  if (processedEventIds.size > MAX_TRACKED_EVENT_IDS) {
    const oldest = processedEventIds.values().next().value
    if (oldest) processedEventIds.delete(oldest)
  }
}

/** Eventos que o diário guardou deste pedido, do mais antigo ao mais novo (para a nova tentativa nascer na situação real). */
async function eventosDoPedidoNoDiario(orderId: string): Promise<any[]> {
  try {
    const prisma = await getPrismaForDb(process.env.IFOOD_AUDIT_DB || 'db_restaurante')
    const linhas = await (prisma as any).ifoodApiLog.findMany({
      where: { method: 'EVENT', order_id: orderId },
      orderBy: { created_at: 'asc' },
      select: { request_body: true },
      take: 200,
    })
    return linhas.map((l: any) => l.request_body).filter((e: any) => e && typeof e === 'object')
  } catch (error: any) {
    console.error(`[iFood Poller] Falha ao ler no diário os eventos do pedido ${orderId}:`, error?.message || error)
    return []
  }
}

/**
 * Ao subir a nuvem: os pedidos novos cuja última tentativa falhou nas últimas 24 h (pelo diário) voltam para a fila da loja.
 * Fase 4 do Mergulho (09:F3): antes a fila vivia só na memória e a publicação (que reinicia a nuvem) perdia o pedido.
 */
export async function recuperarPedidosQueFalharam(): Promise<number> {
  try {
    const prisma = await getPrismaForDb(process.env.IFOOD_AUDIT_DB || 'db_restaurante')
    const linhas = await (prisma as any).ifoodApiLog.findMany({
      where: { method: 'EVENT', endpoint: '/events/polling/PLC', created_at: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) } },
      orderBy: { created_at: 'asc' },
      select: { order_id: true, success: true, request_body: true, response_body: true },
      take: 5000,
    })
    let recuperados = 0
    for (const { dbName, event } of pedidosQueFalharam(linhas)) {
      // Linha antiga (sem a loja no diário): acha a loja pelo ID dela no iFood
      const dono = dbName ?? (await localizarTenantDaLoja(String(event?.merchantId ?? ''), 'IFOOD'))?.dbName
      if (!dono) {
        console.warn(`[iFood Poller] Pedido ${event?.orderId} falhou antes de reiniciar, mas a loja dele não foi encontrada.`)
        continue
      }
      if (filaDePedidosNovos.falhou(dono, event)) recuperados++
    }
    if (recuperados > 0) console.warn(`[iFood Poller] ${recuperados} pedido(s) novo(s) que falharam antes de reiniciar voltaram para a fila.`)
    return recuperados
  } catch (error: any) {
    console.error('[iFood Poller] Falha ao reler no diário os pedidos que falharam:', error?.message || error)
    return 0
  }
}

function getTokenStore(dbName: string = DEFAULT_TENANT): TokenStore {
  if (!tokenStates.has(dbName)) {
    tokenStates.set(dbName, { accessToken: '', refreshToken: '', expiresAt: 0 })
  }
  return tokenStates.get(dbName)!
}

async function loadIfoodTokens(dbName: string = DEFAULT_TENANT): Promise<TokenStore> {
  const current = getTokenStore(dbName)
  if (current.accessToken || current.refreshToken) return current

  try {
    const prisma = await getPrismaForDb(dbName)
    const profile = await (prisma as any).companyProfile.findFirst({
      select: { ifoodAccessToken: true, ifoodRefreshToken: true, ifoodTokenExpiresAt: true },
    })
    if (profile?.ifoodAccessToken || profile?.ifoodRefreshToken) {
      const loaded = {
        accessToken: profile.ifoodAccessToken || '',
        refreshToken: profile.ifoodRefreshToken || '',
        expiresAt: profile.ifoodTokenExpiresAt ? new Date(profile.ifoodTokenExpiresAt).getTime() : 0,
      }
      tokenStates.set(dbName, loaded)
      if (dbName === DEFAULT_TENANT) tokenState = loaded
      return loaded
    }
  } catch (error: any) {
    console.error(`[iFood Token Load Error] Tenant ${dbName}:`, error?.message || error)
  }
  return current
}

async function persistIfoodTokens(dbName: string, tokens: TokenStore) {
  try {
    const prisma = await getPrismaForDb(dbName)
    const profile = await (prisma as any).companyProfile.findFirst()
    if (profile) {
      await (prisma as any).companyProfile.update({
        where: { id: profile.id },
        data: {
          ifoodAccessToken: tokens.accessToken,
          ifoodRefreshToken: tokens.refreshToken,
          ifoodTokenExpiresAt: new Date(tokens.expiresAt),
        },
      })
    }
  } catch (error: any) {
    console.error(`[iFood Token Persist Error] Tenant ${dbName}:`, error?.message || error)
  }
}

let isPolling = false
let pollIntervalTimer: NodeJS.Timeout | null = null

async function pollAllIfoodTenants() {
  const tenantNames = await getActiveTenantDbNames().catch((error: any) => {
    console.error('[iFood Poller] Falha ao listar tenants ativos:', error?.message || error)
    return [DEFAULT_TENANT]
  })

  for (const tenantName of tenantNames.length > 0 ? tenantNames : [DEFAULT_TENANT]) {
    await pollIfoodEvents(tenantName)
  }
}

export function setIfoodTokens(tokens: { accessToken: string; refreshToken: string; expiresIn?: number }, dbName = DEFAULT_TENANT) {
  const updated = {
    accessToken: tokens.accessToken,
    refreshToken: tokens.refreshToken,
    expiresAt: Date.now() + (tokens.expiresIn || 21600) * 1000,
  }
  tokenStates.set(dbName, updated)
  if (dbName === DEFAULT_TENANT) tokenState = updated
  void persistIfoodTokens(dbName, updated)
}

export function getIfoodTokenState(dbName = DEFAULT_TENANT) {
  const current = getTokenStore(dbName)
  return {
    hasToken: Boolean(current.accessToken),
    expiresAt: new Date(current.expiresAt).toISOString(),
    isExpired: Date.now() >= current.expiresAt,
    isPollingRunning: Boolean(pollIntervalTimer),
    tenant: dbName,
  }
}

export async function getValidAccessToken(dbName = DEFAULT_TENANT): Promise<string> {
  const current = await loadIfoodTokens(dbName)
  if (Date.now() < current.expiresAt - 60000 && current.accessToken) {
    return current.accessToken
  }

  if (!current.refreshToken) return ''

  try {
    const refreshed = await ifoodApi.refreshAccessToken(current.refreshToken)
    setIfoodTokens(refreshed, dbName)
    return refreshed.accessToken
  } catch (err) {
    console.error(`[iFood Token Refresh Error] Tenant ${dbName}:`, err)
    return current.accessToken
  }
}

/**
 * Executa uma rodada única de polling de eventos no iFood
 */
export async function pollIfoodEvents(dbName = DEFAULT_TENANT): Promise<{ polled: boolean; eventsProcessed: number; ordersCreated: number }> {
  if (isPolling) {
    return { polled: false, eventsProcessed: 0, ordersCreated: 0 }
  }

  isPolling = true
  let eventsProcessed = 0
  let ordersCreated = 0

  try {
    let token = await getValidAccessToken(dbName)
    if (!token) {
      return { polled: false, eventsProcessed: 0, ordersCreated: 0 }
    }

    let events: any[] = []
    try {
      events = await ifoodApi.getEvents(token)
    } catch (err: any) {
      if (err.message?.includes('token expired') || err.message?.includes('401')) {
        console.log('[iFood Polling] Access token expirado no iFood. Renovando token via refresh_token...')
        const refreshed = await ifoodApi.refreshAccessToken(getTokenStore(dbName).refreshToken)
        setIfoodTokens(refreshed, dbName)
        token = refreshed.accessToken
        events = await ifoodApi.getEvents(token)
      } else {
        throw err
      }
    }
    events = [...(Array.isArray(events) ? events : []), ...filaDePedidosNovos.retirar(dbName)]
    if (events.length === 0) {
      return { polled: true, eventsProcessed: 0, ordersCreated: 0 }
    }

    console.log(`[iFood Polling] ${events.length} evento(s) recebido(s) da fila do iFood!`)

    // ACK IMEDIATO de todos os eventos recebidos (exigência da homologação), antes de qualquer processamento.
    // As retentativas internas (__retry) já foram confirmadas antes e não são reenviadas.
    let ackMs = 0
    const idsRecebidos = Array.from(new Set(events.filter((e: any) => !e?.__retry && e?.id).map((e: any) => String(e.id))))
    if (idsRecebidos.length > 0) {
      const ackInicio = Date.now()
      const acked = await ifoodApi.acknowledgeEvents(token, idsRecebidos)
      ackMs = Date.now() - ackInicio
      console.log(`[iFood Polling] ACK de ${idsRecebidos.length} evento(s) ${acked ? 'confirmado' : 'FALHOU'} no iFood em ${ackMs}ms.`)
    }

    // Situação real de cada pedido neste lote (aceito no Gestor, despachado, entregue): o pedido novo já nasce nela
    const situacaoNoLote = situacaoFinalPorPedido(events)

    for (const event of events) {
      eventsProcessed++
      const eventKey = event?.id ? String(event.id) : ''
      if (eventKey && !event.__retry) {
        if (processedEventIds.has(eventKey)) {
          console.log(`[iFood Polling] Evento ${eventKey} duplicado; descartado.`)
          void journalEvent(event, 'polling', { ackMs, duplicate: true, outcome: 'duplicado; descartado', tenant: dbName })
          continue
        }
        markEventProcessed(eventKey)
      }
      let eventProcessed = true
      let outcome = 'evento informativo (sem ação)'

      // Registra evento no histórico recente em memória
      recentDeliveryEvents.unshift({
        id: String(event.id || Date.now()),
        platform: 'IFOOD',
        receivedAt: new Date().toISOString(),
        headers: { source: 'ifood-polling' },
        body: event,
      })

      if (recentDeliveryEvents.length > 30) {
        recentDeliveryEvents.pop()
      }

      // Evento PLC = Placed (Novo pedido criado no iFood)
      if (event.code === 'PLC' && event.orderId) {
        try {
          console.log(`[iFood Polling] Processando novo pedido PLC (${event.orderId})...`)
          {
            // O evento veio com a autorização DESTE cliente: o pedido é dele (não precisa procurar pelo ID da loja).
            const prismaDup = await getPrismaForDb(dbName)
            const jaExiste = await (prismaDup as any).pedido.findFirst({
              where: { observacao: { contains: `[iFood:${event.orderId}]` } },
              select: { id: true },
            })
            if (jaExiste) {
              console.log(`[iFood Polling] Pedido ${event.orderId} já existe (#${jaExiste.id}); evento PLC ignorado.`)
              filaDePedidosNovos.resolvido(dbName, String(event.orderId))
              // Nova tentativa encerrada fica no diário: senão a última linha seguiria "falhou" e voltaria para a fila ao reiniciar
              if (event.__retry) void journalEvent(event, 'polling', { outcome: `pedido já existe (#${jaExiste.id}); nova tentativa encerrada`, tenant: dbName })
              continue
            }
          }
          // Nova tentativa (09:F3): o que o iFood avisou deste pedido enquanto ele não entrava (o diário guarda os eventos)
          const eventosAnteriores = event.__retry ? await eventosDoPedidoNoDiario(String(event.orderId)) : []
          if (eventosAnteriores.some(eventoDeCancelado)) {
            console.warn(`[iFood Polling] Pedido ${event.orderId} foi cancelado no iFood antes de conseguir entrar; não é gravado.`)
            filaDePedidosNovos.resolvido(dbName, String(event.orderId))
            void journalEvent(event, 'polling', { outcome: 'cancelado no iFood antes de conseguir entrar (nada a preparar)', tenant: dbName })
            continue
          }
          let order: any = null
          try {
            order = await ifoodApi.getOrderDetails(token, event.orderId)
          } catch (err: any) {
            if (err.message?.includes('token expired') || err.message?.includes('401')) {
              console.log('[iFood Polling] Token expirado ao buscar detalhes. Renovando...')
              const refreshed = await ifoodApi.refreshAccessToken(getTokenStore(dbName).refreshToken)
              setIfoodTokens(refreshed, dbName)
              token = refreshed.accessToken
              order = await ifoodApi.getOrderDetails(token, event.orderId)
            } else {
              throw err
            }
          }

          // 1. Cliente: o que está sendo consultado (a autorização do iFood é por loja/cliente). Antes procurava de
          // novo pelo ID da loja e, com a busca quebrada, tudo caía no banco de teste.
          const tenantDbName = dbName
          const prisma = await getPrismaForDb(dbName)

          // 2. Cliente: o iFood manda um 0800 compartilhado, não o telefone do cliente (ver contatoDoClienteIfood). O
          // "telefone" guardado é 0800 + localizador (único por pedido); sem ele, nunca reaproveita cliente de outro pedido.
          const clientName = String(order.customer?.name || 'Cliente iFood')
          const contato = contatoDoClienteIfood(order.customer)

          let client = contato.telefone
            ? await (prisma as any).client.findFirst({
                where: { phone: contato.telefone },
                include: { addresses: true },
              })
            : null

          if (!client) {
            client = await (prisma as any).client.create({
              data: {
                name: clientName,
                phone: contato.telefone,
              },
              include: { addresses: true },
            })
          }

          // 3. Endereço de entrega: SEMPRE o do próprio pedido (antes usava o 1º endereço já salvo do cliente, e com o 0800
          // compartilhado o pedido novo ia com o endereço de outra pessoa). Retirada fica sem endereço.
          let targetAddressId: string | null = null
          const delAddr = order.delivery?.deliveryAddress
          const entrega = enderecoDaEntregaIfood(delAddr)
          if (entrega) {
            const igual = (client.addresses || []).find((a: any) => mesmoEndereco(a, entrega))
            if (igual) {
              targetAddressId = igual.id
            } else {
              const addr = await (prisma as any).address.create({
                data: {
                  client_id: client.id,
                  ...entrega,
                  is_main: !(client.addresses || []).length,
                },
              })
              targetAddressId = addr.id
            }
          }

          // 4. Display ID Diário
          const today = intervaloDoDiaOperacional().inicio // dia operacional: vira às 05:00
          const countToday = await (prisma as any).pedido.count({
            where: { data_abertura: { gte: today } },
          })
          const displayId = countToday + 1

          // 5. Sessão de caixa ativa
          const activeCashier = await (prisma as any).cashierSession.findFirst({
            where: { status: 'OPEN' },
            orderBy: { opened_at: 'desc' },
          })

          // 6. Valores e Itens
          const totalAmount = Number(order.total?.orderAmount ?? order.total?.subTotal ?? 0) || 0
          const deliveryFee = Number(order.total?.deliveryFee || 0)
          const subtotal = Math.max(0, totalAmount - deliveryFee)

          const rawItems = order.items || []
          const itemsToCreate = []
          for (const it of rawItems) {
            const itemName = it.name || 'Item iFood'
            const extCode = it.externalCode || it.id

            // 1. Vínculo manual já feito uma vez (o mais confiável: veio de uma escolha explícita).
            let matchedProduct: any = null
            if (extCode) {
              const mapping = await (prisma as any).deliveryItemMapping.findUnique({
                where: { platform_external_code: { platform: 'IFOOD', external_code: String(extCode) } },
              })
              if (mapping) {
                matchedProduct = await (prisma as any).product.findUnique({ where: { id: mapping.product_id } })
              }
            }
            // 2. Tentativa automática por código (só funciona se o lojista digitou o barcode do
            // Metrics no "Código PDV" do item, lá no painel do iFood).
            if (!matchedProduct && extCode) {
              matchedProduct = await (prisma as any).product.findFirst({
                where: {
                  OR: [
                    { id: extCode },
                    { barcode: extCode },
                  ],
                },
              })
            }
            // 2b. Código curto do produto (o mesmo que o caixa usa, ex.: 175) no "Código PDV" do iFood (12/10/2026)
            const codigoCurto = codigoCurtoDoProduto(it.externalCode)
            if (!matchedProduct && codigoCurto) {
              matchedProduct = await (prisma as any).product.findFirst({ where: { display_id: codigoCurto } })
            }
            // 2c. Código de barras que o próprio iFood manda no item (produto de mercado)
            const ean = eanDoItemIfood(it)
            if (!matchedProduct && ean) {
              matchedProduct = await (prisma as any).product.findFirst({ where: { barcode: ean } })
            }
            // 3. Último recurso: nome exato (frágil — acento/espaço já quebra), só quando um único produto tem esse nome (09:F4)
            if (!matchedProduct && itemName) {
              matchedProduct = await produtoUnicoPeloNome(prisma, itemName)
            }

            // Item vinculado: a observação leva só os adicionais e o que o cliente escreveu (o nome é o do nosso produto);
            // sem vínculo, começa pelo nome do iFood para a cozinha saber o que é (decisão do Thomás, 12/10/2026)
            let obs = matchedProduct ? '' : itemName
            if (Array.isArray(it.options) && it.options.length > 0) {
              const optsStr = it.options.map((o: any) => `${o.name || o.title || 'Opção'} (x${o.quantity || 1})`).join(', ')
              obs += ` [Adicionais: ${optsStr}]`
            }
            if (it.observations) {
              obs += ` (Obs: ${it.observations})`
            }
            obs = obs.trim()

            itemsToCreate.push({
              produto_id: matchedProduct ? matchedProduct.id : undefined,
              // Preço já com os adicionais (o PDV recalcula preço x quantidade); antes caía em 25,00 fixo sem preço
              quantidade: valoresDoItemIfood(it).quantidade,
              valor_unitario: valoresDoItemIfood(it).unitario,
              valor_total: valoresDoItemIfood(it).total,
              observacao: obs || null,
              external_code: extCode ? String(extCode) : null,
              external_name: itemName,
            })
          }

          if (itemsToCreate.length === 0) {
            itemsToCreate.push({
              quantidade: 1,
              valor_unitario: totalAmount,
              valor_total: totalAmount,
              observacao: 'Pedido iFood',
            })
          }

          // Já aceito/despachado/entregue (ex.: aceito no Gestor de Pedidos, ou eventos antigos ao autorizar a loja)
          const situacaoInicial = situacaoMaisAdiantada(
            situacaoNoLote.get(String(event.orderId)) ?? null,
            situacaoFinalPorPedido(eventosAnteriores).get(String(event.orderId)) ?? null,
          )

          // 7. Criar Pedido Canônico em db_restaurante
          const pedido = await (prisma as any).pedido.create({
            data: {
              display_id: displayId,
              numero_diario: displayId,
              origem: 'Delivery',
              plataforma: 'IFOOD',
              caixa_id: activeCashier?.id || null,
              cliente_id: client.id,
              endereco_entrega_id: targetAddressId,
              subtotal: subtotal,
              valor_frete: deliveryFee,
              valor_final: totalAmount,
              valor_troco: 0,
              status: situacaoInicial?.status ?? 'Aberto',
              status_delivery: situacaoInicial?.status_delivery ?? 'Pendente',
              data_fechamento: situacaoInicial?.status === 'Fechado' ? new Date() : undefined,
              // CPF/CNPJ que o cliente informou no iFood para a nota (antes era descartado) e a forma de pagamento de verdade:
              // pago no app ou "Pagar na entrega" (antes todo pedido virava "Pagamento via iFood"), com o código da loja
              cpf_na_nota: documentoDoCliente(order.customer),
              observacao: observacaoDoPedidoIfood(event.orderId, order.displayId || event.orderId, order),
              sincronizado_web: true,
              itens: {
                create: itemsToCreate,
              },
            },
            include: { itens: true },
          })

          ordersCreated++
          console.log(`[iFood Polling] Pedido #${pedido.display_id} gravado em ${tenantDbName}! UUID: ${pedido.uuid}`)

          // 7b. Valores do iFood (itens, frete, desconto da loja × do iFood, taxa de serviço), 15/10/2026: o pedido só guarda o
          // total; o repasse da conferência e o PDV usam estes. Nunca derruba o pedido (sem a linha, a conferência faz como antes).
          await gravarValoresDaPlataforma(prisma, pedido.id, valoresDoPedidoIfood(order))

          // 8. Transmissão SSE para os PDVs, no mesmo formato da lista de pendentes (endereço do pedido, bairro, CEP, taxa
          // de entrega e produto vinculado). Antes era um formato próprio, com o bairro sempre "Centro" e sem o produto.
          try {
            const [fullOrderDto] = await montarPedidosOnline(prisma as any, [pedido])

            // Só a loja do pedido (LGPD, 08/10/2026): antes ia para todas as lojas conectadas e para a loja de teste.
            // Alerta de pedido novo só para o que ainda espera aceite; o resto o PDV pega na lista (até 5 s), na situação real.
            if (!situacaoInicial) sseManager.notifyTenant(tenantDbName, 'new_order', fullOrderDto)
            else sseManager.notifyTenant(tenantDbName, 'order_status_change', { order_id: pedido.uuid, display_id: pedido.display_id, status: pedido.status, status_delivery: pedido.status_delivery })
          } catch (sseErr) {
            console.error('[iFood SSE Error]:', sseErr)
          }
                } catch (orderErr) {
                  eventProcessed = false
                  console.error(`[iFood Polling Order Error] Falha ao processar pedido ${event.orderId}:`, orderErr)
                }
      }

      // Cancelamento (HSD / CAR / CARF / CAN): tratamento único, o mesmo do webhook.
      if (isCancellationRelatedEvent(event)) {
        try {
          outcome = await processCancellationEvent(event, token, 'polling')
          console.log(`[iFood Polling] ${event.code || event.fullCode} (${event.orderId}): ${outcome}`)
        } catch (canErr: any) {
          outcome = `erro ao tratar cancelamento: ${canErr?.message || canErr}`
          console.error(`[iFood Polling] Falha ao tratar ${event.code} de ${event.orderId}:`, canErr)
        }
      }

      // Aceito (CFM), pronto (RTP), despachado (DSP) e concluído (CON): o pedido acompanha a situação real, só para a frente.
      // Antes só o CON era tratado: pedido aceito no Gestor de Pedidos ficava "Pendente" no PDV (12/10/2026).
      const situacao = event.code === 'PLC' ? null : situacaoDoEvento(event)
      if (situacao && event.orderId) {
        try {
          const prisma = await getPrismaForDb(dbName)
          const order = await (prisma as any).pedido.findFirst({
            where: { observacao: { contains: `[iFood:${event.orderId}]` } },
          })
          if (!order) {
            outcome = `${situacao.status_delivery}: pedido não existe aqui (nada feito)`
          } else if (order.status === 'Cancelado' || !avancaSituacao(order.status_delivery, situacao)) {
            outcome = `${situacao.status_delivery}: pedido já está em ${order.status_delivery} (nada muda)`
          } else {
            await (prisma as any).pedido.update({
              where: { id: order.id },
              data: {
                status: situacao.status,
                status_delivery: situacao.status_delivery,
                ...(situacao.status === 'Fechado' ? { data_fechamento: new Date() } : {}),
              },
            })
            outcome = `pedido #${order.display_id}: ${order.status_delivery} -> ${situacao.status_delivery}`
            sseManager.notifyTenant(dbName, 'order_status_change', {
              order_id: order.uuid,
              display_id: order.display_id,
              status: situacao.status,
              status_delivery: situacao.status_delivery,
            })
          }
        } catch (sitErr: any) {
          eventProcessed = false
          outcome = `falha ao atualizar a situação: ${sitErr?.message || sitErr}`
          console.error(`[iFood Polling] Falha ao tratar ${event.code} de ${event.orderId}:`, sitErr)
        }
      }

      // Pedido novo que falhou ao gravar: o ACK já foi dado, então tenta de novo nas próximas rodadas desta loja.
      if (event.code === 'PLC' && event.orderId) {
        const key = String(event.orderId)
        if (eventProcessed) {
          filaDePedidosNovos.resolvido(dbName, key)
          outcome = 'pedido novo gravado'
        } else if (filaDePedidosNovos.falhou(dbName, event)) {
          const tentativa = filaDePedidosNovos.tentativa(dbName, key) + 1
          outcome = `pedido novo FALHOU (nova tentativa ${tentativa}/${MAX_TENTATIVAS_PEDIDO_NOVO})`
          console.warn(`[iFood Polling] Pedido ${key} será reprocessado na próxima rodada (tentativa ${tentativa}/${MAX_TENTATIVAS_PEDIDO_NOVO}).`)
        } else {
          outcome = `pedido novo NÃO ENTROU depois de ${MAX_TENTATIVAS_PEDIDO_NOVO} tentativas (confira no Gestor de Pedidos do iFood)`
          console.error(`[iFood Polling] Pedido ${key} não entrou depois de ${MAX_TENTATIVAS_PEDIDO_NOVO} tentativas.`)
        }
      }
      void journalEvent(event, 'polling', { ackMs, outcome, success: eventProcessed, tenant: dbName })
    }

    return { polled: true, eventsProcessed, ordersCreated }
  } catch (err: any) {
    console.error('[iFood Polling Loop Error]:', err.message)
    return { polled: false, eventsProcessed, ordersCreated }
  } finally {
    isPolling = false
  }
}

/**
 * Inicia o worker de polling contínuo a cada 30 segundos (recomendação da documentação do iFood)
 */
export function startIfoodPollingLoop() {
  if (pollIntervalTimer) {
    return
  }

  console.log('🚀 [iFood Poller] Iniciando worker de eventos iFood (polling a cada 30s, conforme a homologação)...')
  // Antes da 1ª checagem, os pedidos novos que falharam antes de reiniciar voltam para a fila (09:F3)
  recuperarPedidosQueFalharam()
    .catch(() => 0)
    .finally(() => pollAllIfoodTenants().catch((e) => console.error('[iFood Initial Poll Error]:', e)))

  pollIntervalTimer = setInterval(() => {
    pollAllIfoodTenants().catch((e) => console.error('[iFood Interval Poll Error]:', e))
  }, 30000)
}
