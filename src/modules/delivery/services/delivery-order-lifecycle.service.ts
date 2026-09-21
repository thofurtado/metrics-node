import { ifoodApi, IfoodCancelResult } from './ifood-api.service'
import { env } from '@/env'
import { getValidAccessToken } from './ifood-poller'
import { writeJournal } from './ifood-events.service'
import { food99Api } from './food99-api.service'

interface LifecyclePedido {
  id: number
  uuid: string
  observacao?: string | null
  display_id: number
}

interface LifecycleOptions {
  /** Banco do tenant dono do pedido (o token do iFood é guardado por tenant). */
  dbName?: string
  /** Motivo de cancelamento escolhido pelo operador (código vindo de /cancellationReasons). */
  cancelCode?: string
  cancelReason?: string
}

/** Pedido da 99Food: id do pedido e a loja (app_shop_id) gravados na observação pelo webhook. */
export function extractFood99Order(observacao?: string | null): { orderId: string; appShopId: string | null } | null {
  const obs = observacao || ''
  if (!obs.includes('[99Food')) return null
  const m = obs.match(/\[99Food:(\d+)\]/) || obs.match(/Pedido #(\d+)/)
  if (!m) return null
  const shop = obs.match(/\[99Loja:([^\]]+)\]/)
  return { orderId: m[1], appShopId: shop ? shop[1] : env.FOOD99_APP_SHOP_ID ?? null }
}

export function extractIfoodOrderId(observacao?: string | null): string | null {
  const obs = observacao || ''
  const match = obs.match(/\[iFood:([a-zA-Z0-9-]+)\]/) || (obs.includes('[iFood]') ? obs.match(/Pedido #([a-zA-Z0-9-]+)/) : null)
  return match ? match[1] : null
}

/**
 * Cancelamento do pedido na plataforma de origem (hoje: iFood).
 * Retorna handled=false quando o pedido não é de uma plataforma externa.
 */
export async function cancelDeliveryOrderOnPlatform(
  pedido: LifecyclePedido,
  options: LifecycleOptions = {},
): Promise<{ handled: boolean } & IfoodCancelResult> {
  const food99 = extractFood99Order(pedido.observacao)
  if (food99) {
    if (!food99.appShopId) return { handled: true, ok: false, message: 'Loja da 99Food não identificada neste pedido.' }
    const reasonId = Number(options.cancelCode)
    const validReason = [1010, 1020, 1030, 1040, 1050, 1060, 1070, 1071, 1072, 1073, 1074, 1080].includes(reasonId) ? reasonId : 1030
    const detail = options.cancelReason || (validReason === 1080 ? 'Cancelado pelo estabelecimento' : undefined)
    console.log(`[99Food Lifecycle] Cancelando pedido #${pedido.display_id} (${food99.orderId}) motivo ${validReason}...`)
    const r = await food99Api.cancelOrder(food99.appShopId, food99.orderId, validReason, detail)
    return { handled: true, ok: r.ok, message: r.ok ? undefined : r.errmsg }
  }

  const externalOrderId = extractIfoodOrderId(pedido.observacao)
  if (!externalOrderId) return { handled: false, ok: true }

  const token = await getValidAccessToken(options.dbName)
  if (!token) {
    console.error(`[iFood Lifecycle] Token iFood indisponível para cancelar o pedido ${externalOrderId}`)
    return { handled: true, ok: false, message: 'A conexão com o iFood está indisponível. Tente novamente em instantes.' }
  }

  console.log(`[iFood Lifecycle] Cancelando pedido #${pedido.display_id} (${externalOrderId}) no iFood...`)
  const result = await ifoodApi.cancelOrderFromPdv(token, externalOrderId, {
    code: options.cancelCode,
    reason: options.cancelReason,
  })
  console.log(`[iFood Lifecycle] Cancelamento solicitado para ${externalOrderId}: ok=${result.ok} código=${result.code ?? '-'}`)
  void writeJournal({
    method: 'PDV',
    endpoint: '/pdv/cancelamento-solicitado',
    orderId: externalOrderId,
    request: { code: options.cancelCode ?? null, reason: options.cancelReason ?? null, pedido: pedido.display_id },
    response: { ok: result.ok, code: result.code ?? null, message: result.message ?? null },
    success: result.ok,
  })
  return { handled: true, ...result }
}

/**
 * Notifica plataformas externas (iFood / 99Food) quando o operador muda o status do pedido no PDV.
 * O cancelamento tem função própria: cancelDeliveryOrderOnPlatform.
 */
export async function handleDeliveryOrderStatusChange(
  pedido: LifecyclePedido,
  newStatus: string,
  options: LifecycleOptions = {},
): Promise<boolean> {
  const obs = pedido.observacao || ''

  // 1. IFOOD
  const externalOrderId = extractIfoodOrderId(obs)
  if (externalOrderId) {
    if (newStatus === 'cancelled') {
      const result = await cancelDeliveryOrderOnPlatform(pedido, options)
      return result.ok
    }

    const token = await getValidAccessToken(options.dbName)
    if (token) {
      try {
        if (newStatus === 'in_preparation') {
          console.log(`[iFood Lifecycle] Aceitando / Confirmando pedido #${pedido.display_id} (${externalOrderId}) no iFood...`)
          await ifoodApi.confirmOrder(token, externalOrderId)
          console.log(`[iFood Lifecycle] Pedido ${externalOrderId} confirmado com sucesso!`)
        } else if (newStatus === 'dispatched') {
          console.log(`[iFood Lifecycle] Despachando pedido #${pedido.display_id} (${externalOrderId}) no iFood...`)
          await ifoodApi.dispatchOrder(token, externalOrderId)
          console.log(`[iFood Lifecycle] Pedido ${externalOrderId} despachado para entrega com sucesso!`)
        } else if (newStatus === 'conferencia') {
          console.log(`[iFood Lifecycle] Marcando pedido #${pedido.display_id} (${externalOrderId}) como pronto para retirada no iFood (readyToPickup)...`)
          const ready = await ifoodApi.readyToPickup(token, externalOrderId)
          if (!ready) return false
        }
      } catch (err: any) {
        console.error(`[iFood Lifecycle Error] Falha ao atualizar status ${newStatus} no iFood:`, err.message)
        return false
      }
    }
  }

  // 2. 99FOOD
  const food99 = extractFood99Order(obs)
  if (food99) {
    console.log(`[99Food Lifecycle] Status do pedido #${pedido.display_id} (${food99.orderId}) atualizado para ${newStatus}`)
    if (!food99.appShopId) {
      console.error(`[99Food Lifecycle] Loja (app_shop_id) não identificada para o pedido ${food99.orderId}`)
      return false
    }
    if (newStatus === 'cancelled') {
      const result = await cancelDeliveryOrderOnPlatform(pedido, options)
      return result.ok
    }
    if (newStatus === 'in_preparation') {
      const r = await food99Api.confirmOrder(food99.appShopId, food99.orderId)
      console.log(`[99Food Lifecycle] Confirmação do pedido ${food99.orderId}: ok=${r.ok} errno=${r.errno ?? '-'} ${r.errmsg ?? ''}`)
      return r.ok
    }
    if (newStatus === 'conferencia') {
      const r = await food99Api.readyOrder(food99.appShopId, food99.orderId)
      console.log(`[99Food Lifecycle] Pedido ${food99.orderId} pronto: ok=${r.ok} errno=${r.errno ?? '-'} ${r.errmsg ?? ''}`)
      return r.ok
    }
  }

  return true
}
