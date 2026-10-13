import type { SituacaoIfood } from './ifood-situacao'

/**
 * Regras do pedido da 99Food (13/10/2026, Katatau, pedidos reais).
 *
 * Endereço: a 99 manda o NÚMERO em `street_number` ("642") e o complemento em `house_number` ("casa", "apto 12"); o ponto de
 * referência vem em `reference`. A nuvem usava `house_number` como número: o pedido da Jessica chegou "casa ... S/N" e o
 * motoboy ficou sem o número da casa.
 *
 * Avisos: a nuvem só tratava o orderNew; orderFinish (concluído pela 99) e orderCancel ficavam só no diário e o pedido seguia
 * "Saiu para entrega" no Metrics (o 99 nº 1 foi concluído às 09:52 e ficou na rua). Regra do Thomás: a situação do Metrics é
 * sempre a da plataforma.
 */

const texto = (v: unknown): string => (v == null ? '' : String(v).trim())

export interface EnderecoDa99 {
  rua: string
  numero: string
  complemento: string | null
  /** "Rua X, 642 - Bairro" para o aviso ao vivo do PDV. */
  linha: string
}

export function enderecoDa99(recv: any): EnderecoDa99 {
  const rua = texto(recv?.street_name) || texto(recv?.poi_address)
  const numero = texto(recv?.street_number) || 'S/N'
  const partes: string[] = []
  for (const p of [texto(recv?.house_number), texto(recv?.complement), texto(recv?.reference)]) {
    if (p && !partes.some(x => x.toLowerCase() === p.toLowerCase())) partes.push(p)
  }
  const complemento = partes.length ? partes.join(' - ') : null
  const bairro = texto(recv?.district)
  const linha = rua ? `${rua}, ${numero}${complemento ? ' (' + complemento + ')' : ''}${bairro ? ' - ' + bairro : ''}` : ''
  return { rua, numero, complemento, linha }
}

export type AvisoDa99 = { tipo: 'situacao'; situacao: SituacaoIfood } | { tipo: 'cancelado' } | null

/** O que cada aviso da 99 muda no pedido (null = só vai para o diário: shopStatus, cardápio, vínculo da loja...). */
export function avisoDa99(tipo: string): AvisoDa99 {
  switch (tipo) {
    case 'orderConfirm': return { tipo: 'situacao', situacao: { status: 'Aberto', status_delivery: 'EmPreparo' } }
    case 'orderReady': return { tipo: 'situacao', situacao: { status: 'Aberto', status_delivery: 'Conferencia' } }
    case 'orderDelivering':
    case 'orderDispatch': return { tipo: 'situacao', situacao: { status: 'Aberto', status_delivery: 'SaiuEntrega' } }
    case 'orderFinish':
    case 'orderDelivered':
    case 'orderComplete': return { tipo: 'situacao', situacao: { status: 'Fechado', status_delivery: 'Entregue' } }
    case 'orderCancel': return { tipo: 'cancelado' }
    default: return null
  }
}
