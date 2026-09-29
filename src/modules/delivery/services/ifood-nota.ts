/**
 * Dados do pedido do iFood que vão para a NFC-e do delivery (29/09/2026, decisão do Thomás: seguir "o padrão que o iFood
 * usa"). Conferido no diário real (`ifood_api_logs` do db_restaurante, 92 pedidos de homologação), não na documentação:
 * - o cliente vem com `customer.documentType` + `customer.documentNumber` quando informa documento para a nota (os tipos têm
 *   o nome das etiquetas da nota: CPF, CNPJ, idEstrangeiro); antes a nuvem lia só o nome e o telefone e jogava o CPF fora;
 * - `merchant.id` é o código da loja no iFood (vai na nota como identificação da loja na plataforma);
 * - `payments.methods[]` traz `method` (CREDIT, DEBIT, PIX...), `type` (ONLINE/OFFLINE) e `prepaid`; antes todo pedido virava
 *   "Pagamento via iFood", até o pago na entrega (o PDV achava que estava pago e o motoboy não cobrava).
 */

const NOMES_DAS_FORMAS: Record<string, string> = {
  CREDIT: 'Crédito',
  DEBIT: 'Débito',
  PIX: 'Pix',
  CASH: 'Dinheiro',
  MEAL_VOUCHER: 'Vale refeição',
  FOOD_VOUCHER: 'Vale alimentação',
  GIFT_CARD: 'Vale presente',
  DIGITAL_WALLET: 'Carteira digital',
}

/** CPF (11 dígitos) ou CNPJ (14) que o cliente informou no iFood para a nota; null quando não informou (ou outro tipo). */
export function documentoDoCliente(customer: any): string | null {
  const tipo = String(customer?.documentType ?? '').trim().toUpperCase()
  const digitos = String(customer?.documentNumber ?? '').replace(/\D/g, '')
  if (tipo === 'CPF' && digitos.length === 11) return digitos
  if (tipo === 'CNPJ' && digitos.length === 14) return digitos
  return null
}

/** Formas do pedido em palavras e se o cliente paga na entrega (alguma forma OFFLINE ou não pré-paga). */
export function resumoDoPagamento(payments: any): { naEntrega: boolean; texto: string } {
  const metodos: any[] = Array.isArray(payments?.methods) ? payments.methods : []
  if (metodos.length === 0) return { naEntrega: false, texto: '' }
  const naEntrega = metodos.some((m) => String(m?.type ?? '').toUpperCase() === 'OFFLINE' || m?.prepaid === false)
  const nomes = [...new Set(metodos.map((m) => {
    const codigo = String(m?.method ?? '').toUpperCase()
    return NOMES_DAS_FORMAS[codigo] ?? (codigo || 'Outro')
  }))]
  const troco = metodos.map((m) => Number(m?.cash?.changeFor ?? 0)).find((v) => v > 0)
  let texto = nomes.join(' + ')
  if (troco) texto += ` (troco para R$ ${troco.toFixed(2).replace('.', ',')})`
  return { naEntrega, texto }
}

/**
 * Observação do pedido do iFood no formato que o PDV entende: "Pagamento via iFood (Crédito)" = pago no app;
 * "Pagar na entrega: Dinheiro (troco para R$ 50,00)" = o motoboy cobra; "[iFoodLoja:<id>]" = código da loja no iFood.
 */
export function observacaoDoPedidoIfood(orderId: string, displayId: string | number, order: any): string {
  const pagamento = resumoDoPagamento(order?.payments)
  const texto = pagamento.naEntrega
    ? `Pagar na entrega: ${pagamento.texto || 'a combinar'}`
    : `Pagamento via iFood${pagamento.texto ? ` (${pagamento.texto})` : ''}`
  const loja = order?.merchant?.id ? ` | [iFoodLoja:${String(order.merchant.id)}]` : ''
  return `[iFood:${orderId}] Pedido #${displayId} | ${texto}${loja}`
}
