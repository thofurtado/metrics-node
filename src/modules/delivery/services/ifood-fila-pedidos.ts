/**
 * Fila de nova tentativa dos pedidos novos do iFood (evento PLC) que falharam ao gravar. Fase 4 do Mergulho (09:F3, 15/10/2026).
 *
 * O ACK sai logo depois do polling (exigência da homologação), então o iFood não manda o evento de novo: se o pedido falha ao
 * gravar (banco fora do ar, erro passageiro), só esta fila o salva. Antes:
 * - a fila era UMA para todas as lojas: a rodada de polling da loja seguinte pegava o pedido da outra e buscava no iFood com o
 *   token errado (e gastava as tentativas do pedido);
 * - depois da 5ª tentativa o pedido saía da fila e, se falhasse de novo, voltava com a contagem zerada (tentava para sempre);
 * - vivia só na memória: reiniciar a nuvem (toda publicação reinicia) perdia o pedido.
 * Agora: uma fila por loja, até 20 tentativas (uma por rodada de 30 s, cerca de 10 minutos) e, ao subir, a nuvem relê no diário
 * os pedidos novos cuja última tentativa falhou nas últimas 24 horas. Pedido já gravado nunca duplica: o polling confere antes.
 */

import { pesoDaSituacao, type SituacaoIfood } from './ifood-situacao'

export const MAX_TENTATIVAS_PEDIDO_NOVO = 20

interface Entrada {
  dbName: string
  event: any
  tentativas: number
}

function semMarcaDeRetry(event: any): any {
  const { __retry, ...limpo } = event || {}
  return limpo
}

export class FilaDePedidosNovos {
  private readonly fila = new Map<string, Entrada>()

  private chave(dbName: string, orderId: string) {
    return `${dbName}|${orderId}`
  }

  /**
   * Pedido novo que falhou ao gravar: entra na fila da loja (se já estava, segue a contagem).
   * false = já tinha usado todas as tentativas (sai da fila; quem chama registra no diário que o pedido não entrou).
   */
  falhou(dbName: string, event: any): boolean {
    const orderId = String(event?.orderId ?? '')
    if (!dbName || !orderId) return false
    const k = this.chave(dbName, orderId)
    const atual = this.fila.get(k)
    if (atual) {
      if (atual.tentativas >= MAX_TENTATIVAS_PEDIDO_NOVO) {
        this.fila.delete(k)
        return false
      }
      return true
    }
    this.fila.set(k, { dbName, event: semMarcaDeRetry(event), tentativas: 0 })
    return true
  }

  /** Pedido gravado (ou que já existia): sai da fila. */
  resolvido(dbName: string, orderId: string) {
    this.fila.delete(this.chave(dbName, String(orderId)))
  }

  /** Os pedidos da fila DESTA loja para tentar de novo nesta rodada (marcados com __retry: não recebem ACK de novo). */
  retirar(dbName: string): any[] {
    const eventos: any[] = []
    for (const entrada of this.fila.values()) {
      if (entrada.dbName !== dbName) continue
      entrada.tentativas++
      eventos.push({ ...entrada.event, __retry: true })
    }
    return eventos
  }

  /** Tentativa atual do pedido (para o log). */
  tentativa(dbName: string, orderId: string): number {
    return this.fila.get(this.chave(dbName, String(orderId)))?.tentativas ?? 0
  }

  get tamanho() {
    return this.fila.size
  }
}

export interface LinhaDoDiario {
  order_id: string | null
  success: boolean | null
  request_body: any
  response_body: any
}

/**
 * Pedidos novos (PLC) cuja ÚLTIMA tentativa no diário falhou, com a loja de cada um (null nas linhas antigas, gravadas antes de
 * o diário guardar a loja). As linhas vêm da mais antiga para a mais nova; as marcadas como duplicadas não contam.
 */
export function pedidosQueFalharam(linhas: LinhaDoDiario[]): { dbName: string | null; event: any }[] {
  const ultima = new Map<string, LinhaDoDiario>()
  for (const linha of linhas) {
    if (!linha?.order_id || linha.response_body?.duplicate) continue
    ultima.set(String(linha.order_id), linha)
  }
  return [...ultima.values()]
    .filter((l) => l.success === false && l.request_body && typeof l.request_body === 'object' && l.request_body.orderId)
    .map((l) => ({ dbName: l.response_body?.tenant ? String(l.response_body.tenant) : null, event: semMarcaDeRetry(l.request_body) }))
}

/** Evento de pedido CANCELADO no iFood (CAN). A solicitação (CAR) e a recusa (CARF) não cancelam. */
export function eventoDeCancelado(event: any): boolean {
  const code = String(event?.code || '').toUpperCase()
  const full = String(event?.fullCode || '').toUpperCase()
  return code === 'CAN' || full === 'CANCELLED'
}

/** A situação mais adiantada entre duas (a do lote do polling e a dos eventos guardados no diário). */
export function situacaoMaisAdiantada(a: SituacaoIfood | null, b: SituacaoIfood | null): SituacaoIfood | null {
  if (!a) return b
  if (!b) return a
  return pesoDaSituacao(b.status_delivery) > pesoDaSituacao(a.status_delivery) ? b : a
}
