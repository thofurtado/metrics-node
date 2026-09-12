import { ifoodApi } from './ifood-api.service'
import { getValidAccessToken } from './ifood-poller'

/**
 * Notifica plataformas externas (iFood / 99Food) quando o operador muda o status do pedido no PDV
 */
export async function handleDeliveryOrderStatusChange(
  pedido: { id: number; uuid: string; observacao?: string | null; display_id: number },
  newStatus: string
) {
  const obs = pedido.observacao || ''

  // 1. IFOOD
  const ifoodMatch = obs.match(/\[iFood:([a-zA-Z0-9\-]+)\]/) || (obs.includes('[iFood]') ? obs.match(/Pedido #([a-zA-Z0-9\-]+)/) : null)
  if (ifoodMatch) {
    const externalOrderId = ifoodMatch[1]
    const token = await getValidAccessToken()

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
        } else if (newStatus === 'cancelled') {
          console.log(`[iFood Lifecycle] Cancelando pedido #${pedido.display_id} (${externalOrderId}) no iFood...`)
          await ifoodApi.requestCancellation(token, externalOrderId, 'Cancelado pelo operador no PDV')
          console.log(`[iFood Lifecycle] Pedido ${externalOrderId} cancelado com sucesso no iFood!`)
        }
      } catch (err: any) {
        console.error(`[iFood Lifecycle Error] Falha ao atualizar status ${newStatus} no iFood:`, err.message)
      }
    }
  }

  // 2. 99FOOD
  const food99Match = obs.match(/\[99Food:([a-zA-Z0-9\-]+)\]/) || (obs.includes('[99Food]') ? obs.match(/Pedido #([a-zA-Z0-9\-]+)/) : null)
  if (food99Match) {
    const externalOrderId = food99Match[1]
    console.log(`[99Food Lifecycle] Status do pedido #${pedido.display_id} (${externalOrderId}) atualizado para ${newStatus}`)
  }
}
