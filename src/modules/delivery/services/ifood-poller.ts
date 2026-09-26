import crypto from 'crypto'
import { ifoodApi } from './ifood-api.service'
import { sseManager } from '@/lib/sse-manager'
import { getActiveTenantDbNames, getPrismaForDb } from '@/lib/tenant-manager'
import { recentDeliveryEvents } from '../http/controllers/webhook-99food'
import { isCancellationRelatedEvent, journalEvent, processCancellationEvent } from './ifood-events.service'

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
// Ids já vistos são descartados; pedidos novos (PLC) que falharem entram numa fila curta de nova tentativa.
const processedEventIds = new Set<string>()
const MAX_TRACKED_EVENT_IDS = 5000
const placedRetryQueue = new Map<string, { event: any; attempts: number }>()
const MAX_PLACED_RETRIES = 5

function markEventProcessed(eventId: string) {
  processedEventIds.add(eventId)
  if (processedEventIds.size > MAX_TRACKED_EVENT_IDS) {
    const oldest = processedEventIds.values().next().value
    if (oldest) processedEventIds.delete(oldest)
  }
}

function takePlacedRetries(): any[] {
  const events: any[] = []
  for (const [orderId, entry] of placedRetryQueue) {
    events.push({ ...entry.event, __retry: true })
    entry.attempts++
    if (entry.attempts > MAX_PLACED_RETRIES) placedRetryQueue.delete(orderId)
  }
  return events
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
    events = [...(Array.isArray(events) ? events : []), ...takePlacedRetries()]
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

    for (const event of events) {
      eventsProcessed++
      const eventKey = event?.id ? String(event.id) : ''
      if (eventKey && !event.__retry) {
        if (processedEventIds.has(eventKey)) {
          console.log(`[iFood Polling] Evento ${eventKey} duplicado; descartado.`)
          void journalEvent(event, 'polling', { ackMs, duplicate: true, outcome: 'duplicado; descartado' })
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
              placedRetryQueue.delete(String(event.orderId))
              continue
            }
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

          // 2. Extrair ou criar cliente
          const clientName = String(order.customer?.name || 'Cliente iFood')
          const clientPhone = String(order.customer?.phone?.number || order.customer?.phone || '11999999999')

          let client = await (prisma as any).client.findFirst({
            where: { phone: clientPhone },
            include: { addresses: true },
          })

          if (!client) {
            client = await (prisma as any).client.create({
              data: {
                name: clientName,
                phone: clientPhone,
              },
              include: { addresses: true },
            })
          }

          // 3. Endereço de entrega
          let targetAddressId = client.addresses?.[0]?.id || null
          const delAddr = order.delivery?.deliveryAddress
          if (!targetAddressId && delAddr) {
            const addr = await (prisma as any).address.create({
              data: {
                client_id: client.id,
                street: delAddr.streetName || delAddr.formattedAddress || 'Rua iFood',
                number: String(delAddr.streetNumber || 'S/N'),
                neighborhood: delAddr.district || 'Centro',
                city: delAddr.city || 'Caraguatatuba',
                state: delAddr.state || 'SP',
                zipcode: delAddr.postalCode || undefined,
                complement: delAddr.complement || undefined,
                is_main: true,
              },
            })
            targetAddressId = addr.id
          }

          // 4. Display ID Diário
          const today = new Date()
          today.setHours(0, 0, 0, 0)
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
          const totalAmount = Number(order.total?.orderAmount || order.total?.subTotal || 25.0)
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
            // 3. Último recurso: nome exato (frágil — acento/espaço já quebra).
            if (!matchedProduct && itemName) {
              matchedProduct = await (prisma as any).product.findFirst({
                where: {
                  name: { equals: itemName, mode: 'insensitive' },
                },
              })
            }

            let obs = itemName
            if (Array.isArray(it.options) && it.options.length > 0) {
              const optsStr = it.options.map((o: any) => `${o.name || o.title || 'Opção'} (x${o.quantity || 1})`).join(', ')
              obs += ` [Adicionais: ${optsStr}]`
            }
            if (it.observations) {
              obs += ` (Obs: ${it.observations})`
            }

            itemsToCreate.push({
              produto_id: matchedProduct ? matchedProduct.id : undefined,
              quantidade: Number(it.quantity || 1),
              valor_unitario: Number(it.unitPrice || it.price || 25.0),
              valor_total: Number(it.totalPrice || (it.unitPrice || 25.0) * (it.quantity || 1)),
              observacao: obs,
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
              status: 'Aberto',
              status_delivery: 'Pendente',
              observacao: `[iFood:${event.orderId}] Pedido #${order.displayId || event.orderId} | Pagamento via iFood`,
              sincronizado_web: true,
              itens: {
                create: itemsToCreate,
              },
            },
            include: { itens: true },
          })

          ordersCreated++
          console.log(`[iFood Polling] Pedido #${pedido.display_id} gravado em ${tenantDbName}! UUID: ${pedido.uuid}`)

          // 8. Transmissão SSE para os PDVs
          try {
            const fullOrderDto = {
              id: pedido.uuid,
              order_id: pedido.uuid,
              display_id: pedido.display_id,
              client_name: client.name,
              client_phone: client.phone,
              address: delAddr?.formattedAddress || 'Endereço iFood',
              neighborhood: delAddr?.district || 'Centro',
              city: delAddr?.city || 'Caraguatatuba',
              total_amount: pedido.valor_final,
              delivery_fee: pedido.valor_frete,
              observations: pedido.observacao || '',
              created_at: pedido.data_abertura,
              items: (pedido.itens || []).map((i: any) => ({
                id: i.uuid,
                name: i.observacao || 'Item',
                quantity: i.quantidade,
                price: i.valor_unitario,
                observation: i.observacao,
              })),
            }

            sseManager.broadcast('new_order', fullOrderDto)
            sseManager.notifyTenant('db_restaurante', 'new_order', fullOrderDto)
            sseManager.notifyTenant(tenantDbName, 'new_order', fullOrderDto)
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

      // Evento CON = Concluded (Pedido entregue / concluído)

      if ((event.code === 'CON' || event.code === 'CONCLUDED') && event.orderId) {
        try {
          console.log(`[iFood Polling] Processando evento CON/CONCLUDED (${event.orderId})...`)
          const tenantDbName = dbName
          const prisma = await getPrismaForDb(dbName)

          const order = await (prisma as any).pedido.findFirst({
            where: { observacao: { contains: event.orderId } }
          })

          if (order) {
            await (prisma as any).pedido.update({
              where: { id: order.id },
              data: {
                status: 'Fechado',
                status_delivery: 'Entregue',
                data_fechamento: new Date(),
              }
            })
            console.log(`[iFood Polling] Pedido #${order.display_id} (${event.orderId}) marcado como Entregue em ${tenantDbName}!`)

            const conDto = {
              order_id: order.uuid,
              display_id: order.display_id,
              status: 'Fechado',
              status_delivery: 'Entregue',
            }
            sseManager.broadcast('order_status_change', conDto)
            sseManager.notifyTenant(tenantDbName, 'order_status_change', conDto)
          }
                } catch (conErr) {
          eventProcessed = false
          console.error(`[iFood Polling CON Error] Falha ao concluir pedido ${event.orderId}:`, conErr)
        }
      }

      if (event.code === 'PLC') outcome = eventProcessed ? 'pedido novo gravado' : 'pedido novo FALHOU (nova tentativa)'
      if (event.code === 'CON' || event.code === 'CONCLUDED') outcome = eventProcessed ? 'pedido concluído' : 'conclusão FALHOU'
      void journalEvent(event, 'polling', { ackMs, outcome, success: eventProcessed })

      // Pedido novo que falhou ao gravar: o ACK já foi dado, então tenta de novo nos próximos ciclos.
      if (!eventProcessed && event.code === 'PLC' && event.orderId) {
        const key = String(event.orderId)
        const entry = placedRetryQueue.get(key)
        if (!entry) placedRetryQueue.set(key, { event: { ...event, __retry: undefined }, attempts: 0 })
        console.warn(`[iFood Polling] Pedido ${key} será reprocessado no próximo ciclo (tentativa ${(entry?.attempts ?? 0) + 1}/${MAX_PLACED_RETRIES}).`)
      } else if (eventProcessed && event.code === 'PLC' && event.orderId) {
        placedRetryQueue.delete(String(event.orderId))
      }
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
  // Executa uma checagem imediata
    pollAllIfoodTenants().catch((e) => console.error('[iFood Initial Poll Error]:', e))

  pollIntervalTimer = setInterval(() => {
    pollAllIfoodTenants().catch((e) => console.error('[iFood Interval Poll Error]:', e))
  }, 30000)
}
