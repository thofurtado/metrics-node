/**
 * Código de entrega do iFood (12/10/2026, pedido do Thomás depois da Katatau). Na entrega feita pela loja (deliveredBy MERCHANT),
 * o iFood pede o código que o cliente passa ao motoboy (evento DDCR) e só conclui o pedido com o código certo (DDCS e CON).
 * Quando o cliente passa o código errado na rua, o pedido fica "saiu para entrega" até o iFood resolver sozinho. Agora o caixa
 * digita o código no PDV (o motoboy liga com ele) e a nuvem manda ao iFood.
 *
 * Conferido no pedido real #5706 da Katatau, não na documentação: POST /order/v1.0/orders/{id}/verifyDeliveryCode com "0000"
 * respondeu 400 {"errorType":"NOT_FOUND","description":"Confirmation code is invalid"} (temos permissão; sem ela seria 403).
 * A resposta do código certo ainda não foi vista: 200 com success true/false, segundo a documentação; tratar os dois.
 */

/** Só os dígitos do código (o cliente pode ditar "12 34"); null quando não tem de 4 a 8 dígitos. */
export function codigoDeEntregaValido(codigo: unknown): string | null {
  const digitos = String(codigo ?? '').replace(/\D/g, '')
  return digitos.length >= 4 && digitos.length <= 8 ? digitos : null
}

/** O que a resposta do iFood quer dizer, na frase para o caixa. */
export function resultadoDoCodigoDeEntrega(status: number, corpo: any): { ok: boolean; mensagem: string } {
  const descricao = String(corpo?.description ?? corpo?.message ?? corpo?.error?.message ?? '').toLowerCase()
  if (status >= 200 && status < 300 && corpo?.success !== false) {
    return { ok: true, mensagem: 'O iFood aceitou o código. O pedido vai para "Entregues" assim que o iFood concluir (alguns segundos).' }
  }
  if ((status >= 200 && status < 300) || descricao.includes('invalid') || descricao.includes('inválid')) {
    return { ok: false, mensagem: 'O iFood disse que o código está errado. Confira com o motoboy o código que o cliente mostrou no app e tente de novo.' }
  }
  if (status === 401 || status === 403) {
    return { ok: false, mensagem: 'O iFood recusou o acesso (autorização da loja). Autorize a loja de novo em Configurações > Integrações.' }
  }
  if (status === 404 || status === 409 || status === 412) {
    return { ok: false, mensagem: 'O iFood não aceita código para este pedido agora (ele pode já estar concluído ou cancelado).' }
  }
  return { ok: false, mensagem: `O iFood não respondeu como esperado (${status}). Tente de novo em instantes.` }
}
