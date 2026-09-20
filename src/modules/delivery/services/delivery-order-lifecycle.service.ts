import { ifoodApi, IfoodCancelResult } from './ifood-api.service'
import { getValidAccessToken } from './ifood-poller'

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
  const food99Match = obs.match(/\[99Food:([a-zA-Z0-9-]+)\]/) || (obs.includes('[99Food]') ? obs.match(/Pedido #([a-zA-Z0-9-]+)/) : null)
  if (food99Match) {
    const externalOrderId99 = food99Match[1]
    console.log(`[99Food Lifecycle] Status do pedido #${pedido.display_id} (${externalOrderId99}) atualizado para ${newStatus}`)
  }

  return true
}
