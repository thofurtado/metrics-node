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

export interface ResultadoDoEnvioDoCardapio {
  taskId: string | null
  ok: boolean
  mensagem: string
  /** O que a 99 disse que falhou (cada operação com lista de falhas), no máximo 20 linhas. */
  falhas: string[]
}

/**
 * Resultado do envio do cardápio (aviso uploadMenuTaskStatus). Fase 4 do Mergulho (10:N6, 15/10/2026). O envio é assíncrono: a
 * resposta do envio só traz o número da tarefa e o resultado chega depois neste aviso. Conferido no diário real (21 e 24/09/2026,
 * 2 envios aceitos): `status` 1 com `message` "success" e `operationList` com a `successList` de cada etapa. Um envio recusado
 * nunca foi visto: qualquer `status` diferente de 1 conta como recusado, e as listas de falha de cada etapa (qualquer chave com
 * "fail" ou "error" no nome) vão para o diário.
 */
export function resultadoDoEnvioDoCardapio(data: any): ResultadoDoEnvioDoCardapio {
  const taskId = data?.taskID ?? data?.task_id ?? data?.taskId
  const falhas: string[] = []
  for (const op of Array.isArray(data?.operationList) ? data.operationList : []) {
    for (const [chave, valor] of Object.entries(op ?? {})) {
      if (!/fail|error/i.test(chave) || valor == null) continue
      const itens = Array.isArray(valor) ? valor : [valor]
      for (const item of itens) {
        if (falhas.length >= 20) break
        const descricao = typeof item === 'string' ? item : JSON.stringify(item)
        falhas.push(`${texto(op?.operationType) || 'etapa'}: ${descricao.slice(0, 300)}`)
      }
    }
  }
  return {
    taskId: taskId != null ? String(taskId) : null,
    ok: Number(data?.status) === 1 && falhas.length === 0,
    mensagem: texto(data?.message),
    falhas,
  }
}

/**
 * Total do pedido da 99 em reais (15/10/2026). Pago no app: o `real_price` (o que a loja recebe; `order_price` no modelo antigo).
 * PAGO NA ENTREGA (`pay_method` 2): o que o cliente paga ao motoboy, `real_pay_price` (= `customer_need_paying_money`). Antes ia
 * o `real_price`, que inclui o desconto bancado pela 99: na Katatau o PDV registrou R$ 28,81 em dinheiro num pedido em que o
 * cliente pagou R$ 14,90 (13/10; também 86,74 × 61,74 e 36,60 × 20,61). A parte que a 99 bancou não passa pela gaveta: vai para
 * a conta corrente da plataforma (desconto da plataforma em pedido_valores_plataforma, a receber na conferência).
 */
export function totalDoPedido99(price: any, payMethod: number): number {
  const reais = (v: unknown) => (Number(v) || 0) / 100
  if (payMethod === 2 && price?.real_pay_price != null) return reais(price.real_pay_price)
  if (price?.real_price != null) return reais(price.real_price)
  return reais(price?.order_price)
}
