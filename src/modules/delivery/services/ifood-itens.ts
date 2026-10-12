/**
 * Itens do pedido do iFood (12/10/2026, conferido no diário real: 92 pedidos, 184 itens do db_restaurante).
 *
 * - Ligação com o produto: o lojista preenche o "Código PDV" do item no portal do iFood (vem em `externalCode`). Antes só valia
 *   o código de barras; na Katatau 2.935 produtos têm código de barras de fábrica de 13 dígitos, trabalhoso de digitar. Agora
 *   vale também o código curto do produto (o mesmo que o caixa usa, `display_id`) e o código de barras que o próprio iFood
 *   manda no item (`ean`), útil para produto de mercado.
 * - Preço: `unitPrice` vem SEM os adicionais e `totalPrice` COM eles (ex.: 5 e 16); a soma dos `totalPrice` bate com o
 *   `subTotal` do pedido nos 92 pedidos. O PDV recalcula "preço x quantidade", então o preço unitário que vai para ele precisa
 *   já ter os adicionais (antes a soma dos itens ficava menor que o pedido).
 */

/** Código curto do produto (display_id) quando o "Código PDV" é só número de até 9 dígitos; senão null. */
export function codigoCurtoDoProduto(codigo: unknown): number | null {
  const texto = String(codigo ?? '').trim()
  if (!/^\d{1,9}$/.test(texto)) return null
  const numero = Number(texto)
  return numero > 0 ? numero : null
}

/** Código de barras que o iFood manda no item (8 a 14 dígitos); senão null. */
export function eanDoItemIfood(item: any): string | null {
  const digitos = String(item?.ean ?? '').replace(/\D/g, '')
  return digitos.length >= 8 && digitos.length <= 14 ? digitos : null
}

/** Quantidade, preço unitário com os adicionais e total da linha. */
export function valoresDoItemIfood(item: any): { quantidade: number; unitario: number; total: number } {
  const quantidade = Number(item?.quantity) > 0 ? Number(item.quantity) : 1
  const unitarioSemAdicionais = Number(item?.unitPrice ?? item?.price ?? 0) || 0
  const total = Number(item?.totalPrice)
  if (Number.isFinite(total) && total > 0) {
    return { quantidade, unitario: Math.round((total / quantidade) * 100) / 100, total }
  }
  return { quantidade, unitario: unitarioSemAdicionais, total: Math.round(unitarioSemAdicionais * quantidade * 100) / 100 }
}
