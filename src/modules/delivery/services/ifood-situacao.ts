/**
 * Situação do pedido do iFood pelos eventos (12/10/2026, decisão do Thomás depois da 1ª loja real, Katatau).
 *
 * Ao autorizar a loja, o iFood mandou de uma vez os eventos do dia inteiro (8 pedidos já aceitos no Gestor de Pedidos, 6
 * entregues, 1 cancelado). A nuvem só tratava PLC (pedido novo), CON e cancelamento: os 8 nasceram "Pendente" e o PDV pediu
 * para aceitar pedidos já entregues. Regra: o Metrics só RECEBE informação; o pedido mostra a situação real.
 * - pedido que chega já aceito/pronto/despachado/entregue nasce nessa situação e NÃO dispara o alerta de pedido novo;
 * - aceito no Gestor de Pedidos (CFM) entra em produção no PDV;
 * - a situação só anda para a frente (o cancelamento é tratado à parte, pelo evento CAN).
 */

export interface SituacaoIfood {
  status: 'Aberto' | 'Fechado'
  status_delivery: 'Pendente' | 'EmPreparo' | 'Conferencia' | 'SaiuEntrega' | 'Entregue'
}

const ORDEM: string[] = ['Pendente', 'EmPreparo', 'Conferencia', 'SaiuEntrega', 'Entregue']
// Nomes que o PDV também usa para as mesmas etapas
const SINONIMOS: Record<string, number> = { EmProducao: 1, EmRota: 3, Finalizado: 4 }

/** Situação que o evento do iFood indica; null quando o evento não muda a situação (ex.: DDCR, HSS, cancelamentos). */
export function situacaoDoEvento(event: any): SituacaoIfood | null {
  const code = String(event?.code || '').toUpperCase()
  const full = String(event?.fullCode || '').toUpperCase()
  if (code === 'CFM' || full === 'CONFIRMED') return { status: 'Aberto', status_delivery: 'EmPreparo' }
  if (code === 'RTP' || full === 'READY_TO_PICKUP') return { status: 'Aberto', status_delivery: 'Conferencia' }
  if (code === 'DSP' || full === 'DISPATCHED') return { status: 'Aberto', status_delivery: 'SaiuEntrega' }
  if (code === 'CON' || full === 'CONCLUDED') return { status: 'Fechado', status_delivery: 'Entregue' }
  return null
}

/** Peso da situação de entrega (desconhecida = 0, igual a Pendente). */
export function pesoDaSituacao(statusDelivery: string | null | undefined): number {
  const texto = String(statusDelivery ?? '')
  const i = ORDEM.indexOf(texto)
  return i >= 0 ? i : (SINONIMOS[texto] ?? 0)
}

/** A situação nova só vale se andar para a frente. */
export function avancaSituacao(atual: string | null | undefined, nova: SituacaoIfood | null): boolean {
  return !!nova && pesoDaSituacao(nova.status_delivery) > pesoDaSituacao(atual)
}

/** Situação mais adiantada de cada pedido entre os eventos do mesmo lote do polling. */
export function situacaoFinalPorPedido(events: any[]): Map<string, SituacaoIfood> {
  const final = new Map<string, SituacaoIfood>()
  for (const e of Array.isArray(events) ? events : []) {
    const orderId = e?.orderId ? String(e.orderId) : ''
    const s = situacaoDoEvento(e)
    if (!orderId || !s) continue
    const atual = final.get(orderId)
    if (!atual || pesoDaSituacao(s.status_delivery) > pesoDaSituacao(atual.status_delivery)) final.set(orderId, s)
  }
  return final
}
