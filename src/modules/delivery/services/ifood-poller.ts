import { ifoodApi } from './ifood-api.service'
import { resolveTenantForMerchant } from './delivery-tenant-resolver'
import { sseManager } from '@/lib/sse-manager'
import { recentDeliveryEvents } from '../http/controllers/webhook-99food'

interface TokenStore {
  accessToken: string
  refreshToken: string
  expiresAt: number
}

// Token inicial obtido via autorização oficial do lojista
export let tokenState: TokenStore = {
  accessToken: 'eyJraWQiOiJlZGI4NWY2Mi00ZWY5LTExZTktODY0Ny1kNjYzYmQ4NzNkOTMiLCJhbGciOiJSUzUxMiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJmNzdhYWYxYy0yYzBiLTRmYzgtYWJhYS1hMTc0ZWNkYzNlNDYiLCJqdGkiOiJmNzdhYWYxYy0yYzBiLTRmYzgtYWJhYS1hMTc0ZWNkYzNlNDY6YmIwYzQxOGQtMWNmZS00YWQxLWE1YzQtM2JkY2IyNmRjM2MxIiwibWVyY2hhbnRfc2NvcGVkIjp0cnVlLCJjbGllbnRfaWQiOiJiYjBjNDE4ZC0xY2ZlLTRhZDEtYTVjNC0zYmRjYjI2ZGMzYzEiLCJ0dmVyIjoidjIiLCJzY29wZSI6WyJpdGVtIiwiY2F0YWxvZyIsIm1lcmNoYW50IiwibG9naXN0aWNzIiwicGlja2luZyIsImNvbmNpbGlhdG9yIiwiYW5hbHl0aWNzIiwic2hpcHBpbmciLCJyZXZpZXciLCJncm9jZXJpZXMiLCJldmVudHMiLCJvcmRlciIsInByb21vdGlvbiJdLCJpc3MiOiJpRm9vZCIsImFwcF9uYW1lIjoidGhvbWFzLWZ1cnRhZG8tdGVzdGUtZCIsIm93bmVyX25hbWUiOiJldXJlY2F0ZWNoIiwiYXVkIjpbIml0ZW0iLCJjYXRhbG9nIiwiZmluYW5jaWFsIiwibWVyY2hhbnQiLCJsb2dpc3RpY3MiLCJwaWNraW5nIiwib2F1dGgtc2VydmVyIiwiYW5hbHl0aWNzIiwic2hpcHBpbmciLCJyZXZpZXciLCJncm9jZXJpZXMiLCJldmVudHMiLCJvcmRlciIsInByb21vdGlvbiJdLCJleHAiOjE3ODkyMjMwNTYsImlhdCI6MTc4OTIwMTQ1NiwibWVyY2hhbnRfc2NvcGUiOlsiMDE1NzI5OWQtNDc5MC00Mzg5LTk3MDMtNDdkNTZiNWZlMTQwOm9yZGVyIiwiMDE1NzI5OWQtNDc5MC00Mzg5LTk3MDMtNDdkNTZiNWZlMTQwOmNhdGFsb2ciLCIwMTU3Mjk5ZC00NzkwLTQzODktOTcwMy00N2Q1NmI1ZmUxNDA6Y29uY2lsaWF0b3IiLCIwMTU3Mjk5ZC00NzkwLTQzODktOTcwMy00N2Q1NmI1ZmUxNDA6cmV2aWV3IiwiMDE1NzI5OWQtNDc5MC00Mzg5LTk3MDMtNDdkNTZiNWZlMTQwOmxvZ2lzdGljcyIsIjAxNTcyOTlkLTQ3OTAtNDM4OS05NzAzLTQ3ZDU2YjVmZTE0MDphbmFseXRpY3MiLCIwMTU3Mjk5ZC00NzkwLTQzODktOTcwMy00N2Q1NmI1ZmUxNDA6c2hpcHBpbmciLCIwMTU3Mjk5ZC00NzkwLTQzODktOTcwMy00N2Q1NmI1ZmUxNDA6aXRlbSIsIjAxNTcyOTlkLTQ3OTAtNDM4OS05NzAzLTQ3ZDU2YjVmZTE0MDpwaWNraW5nIiwiMDE1NzI5OWQtNDc5MC00Mzg5LTk3MDMtNDdkNTZiNWZlMTQwOmdyb2NlcmllcyIsIjAxNTcyOTlkLTQ3OTAtNDM4OS05NzAzLTQ3ZDU2YjVmZTE0MDpldmVudHMiLCIwMTU3Mjk5ZC00NzkwLTQzODktOTcwMy00N2Q1NmI1ZmUxNDA6cHJvbW90aW9uIiwiMDE1NzI5OWQtNDc5MC00Mzg5LTk3MDMtNDdkNTZiNWZlMTQwOm1lcmNoYW50Il19.Aei6aBDQLvd_EG-tqUIyCZrW68d0r18I9HJGOayxx1Y3KoxuOQQQfoYH1UG39QvMKjZrluVzc9s70NTWQQyvOVMp5d7Rl10JIHJmLbqr1BneTGbw9HvaFPpNiOb_KtB33itRgYrIpKvRPKK79otyNcTCGRBQRonqNHduxUYm5dc',
  refreshToken: 'eyJraWQiOiJlZGI4NWY2Mi00ZWY5LTExZTktODY0Ny1kNjYzYmQ4NzNkOTMiLCJhbGciOiJSUzUxMiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJmNzdhYWYxYy0yYzBiLTRmYzgtYWJhYS1hMTc0ZWNkYzNlNDYiLCJjbGllbnRfaWQiOiJiYjBjNDE4ZC0xY2ZlLTRhZDEtYTVjNC0zYmRjYjI2ZGMzYzEiLCJpc3MiOiJpRm9vZCIsImV4cCI6MTc4OTgwNjI1NiwiaWF0IjoxNzg5MjAxNDU2fQ.EOMYb0qwsVN-WEX05P_hpAkmUV3TOzQrXTEz-PYtdF5duHLHZUyBDGmzm96s9kYBGbfV6VUv7rVyI_GwARt12KUGmpX7cqRys5S50jG6ho38kcvv8qtMDapQnTgoCynt8iii1ZI_QQ6ghhieIfatiOk4s6UdTsqaAQaywkHlaFA',
  expiresAt: Date.now() + 21600 * 1000,
}

let isPolling = false
let pollIntervalTimer: NodeJS.Timeout | null = null

export function setIfoodTokens(tokens: { accessToken: string; refreshToken: string; expiresIn?: number }) {
  tokenState = {
    accessToken: tokens.accessToken,
    refreshToken: tokens.refreshToken,
    expiresAt: Date.now() + (tokens.expiresIn || 21600) * 1000,
  }
}

export function getIfoodTokenState() {
  return {
    hasToken: Boolean(tokenState.accessToken),
    expiresAt: new Date(tokenState.expiresAt).toISOString(),
    isExpired: Date.now() >= tokenState.expiresAt,
    isPollingRunning: Boolean(pollIntervalTimer),
  }
}

async function getValidAccessToken(): Promise<string> {
  if (Date.now() < tokenState.expiresAt - 60000 && tokenState.accessToken) {
    return tokenState.accessToken
  }

  // Se estiver próximo do vencimento, renova com refreshToken
  try {
    const refreshed = await ifoodApi.refreshAccessToken(tokenState.refreshToken)
    setIfoodTokens(refreshed)
    return tokenState.accessToken
  } catch (err) {
    console.error('[iFood Token Refresh Error]:', err)
    return tokenState.accessToken
  }
}

/**
 * Executa uma rodada única de polling de eventos no iFood
 */
export async function pollIfoodEvents(): Promise<{ polled: boolean; eventsProcessed: number; ordersCreated: number }> {
  if (isPolling) {
    return { polled: false, eventsProcessed: 0, ordersCreated: 0 }
  }

  isPolling = true
  let eventsProcessed = 0
  let ordersCreated = 0

  try {
    const token = await getValidAccessToken()
    if (!token) {
      return { polled: false, eventsProcessed: 0, ordersCreated: 0 }
    }

    const events = await ifoodApi.getEvents(token)
    if (!Array.isArray(events) || events.length === 0) {
      return { polled: true, eventsProcessed: 0, ordersCreated: 0 }
    }

    console.log(`[iFood Polling] ${events.length} evento(s) recebido(s) da fila do iFood!`)

    const ackIds: string[] = []

    for (const event of events) {
      eventsProcessed++
      ackIds.push(event.id)

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
          const order = await ifoodApi.getOrderDetails(token, event.orderId)

          // 1. Resolver o tenant (Mapeia 4107174 e UUID para db_restaurante)
          const merchantId = String(event.merchantId || order.merchant?.id || '4107174')
          const { dbName, prisma } = await resolveTenantForMerchant(merchantId, 'IFOOD')

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

            let matchedProduct = null
            if (extCode) {
              matchedProduct = await (prisma as any).produto.findFirst({
                where: {
                  OR: [
                    { uuid: extCode },
                    { id: extCode },
                  ],
                },
              })
            }
            if (!matchedProduct && itemName) {
              matchedProduct = await (prisma as any).produto.findFirst({
                where: {
                  nome: { equals: itemName, mode: 'insensitive' },
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
          console.log(`[iFood Polling] Pedido #${pedido.display_id} gravado em ${dbName}! UUID: ${pedido.uuid}`)

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
            sseManager.notifyTenant(dbName, 'new_order', fullOrderDto)
          } catch (sseErr) {
            console.error('[iFood SSE Error]:', sseErr)
          }
        } catch (orderErr) {
          console.error(`[iFood Polling Order Error] Falha ao processar pedido ${event.orderId}:`, orderErr)
        }
      }
    }

    // Confirma recebimento dos eventos para limpar a fila do iFood
    if (ackIds.length > 0) {
      await ifoodApi.acknowledgeEvents(token, ackIds)
      console.log(`[iFood Polling] ${ackIds.length} evento(s) confirmados (ACK) no iFood com sucesso.`)
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
 * Inicia o worker de polling contínuo a cada 15 segundos
 */
export function startIfoodPollingLoop() {
  if (pollIntervalTimer) {
    return
  }

  console.log('🚀 [iFood Poller] Iniciando worker de eventos iFood em tempo real (intervalo: 15s)...')
  // Executa uma checagem imediata
  pollIfoodEvents().catch((e) => console.error('[iFood Initial Poll Error]:', e))

  pollIntervalTimer = setInterval(() => {
    pollIfoodEvents().catch((e) => console.error('[iFood Interval Poll Error]:', e))
  }, 15000)
}
