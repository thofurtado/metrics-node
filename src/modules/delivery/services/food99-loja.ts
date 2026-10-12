/**
 * Loja na 99Food (12/10/2026, Katatau como piloto). Regras do Thomás:
 * - o envio do cardápio do Metrics para a 99 é SÓ para loja nova: a Katatau já tem o cardápio montado na 99 e o envio substitui
 *   o cardápio da loja. Se a 99 devolve qualquer item, o envio é recusado;
 * - a loja é ligada ao nosso app pela página de autorização da 99 (GET /v1/auth/authorizationpage/getUrl, conferido com o app
 *   oficial em 12/10/2026: errno 0 e data.url em merchant.99app.com). O App Shop ID é o código da loja do NOSSO lado.
 */

/** App Shop ID padrão da loja quando ainda não há um salvo: o nome do banco sem "db_" (db_katatau -> metrics-katatau). */
export function appShopIdPadrao(dbName: string): string {
  const base = String(dbName || '').trim().toLowerCase().replace(/^db_/, '').replace(/[^a-z0-9_-]/g, '')
  return base ? `metrics-${base}` : ''
}

/** Pode mandar o cardápio do Metrics para a 99? Só quando a 99 respondeu e a loja não tem nenhum item lá. */
export function decidirEnvioDoCardapio(lista: { ok: boolean; errmsg?: string; items: unknown[] }): { pode: boolean; motivo: string } {
  if (!lista.ok) {
    return { pode: false, motivo: `Não deu para conferir o cardápio que a loja tem na 99 (${lista.errmsg || 'sem resposta'}). Nada foi enviado.` }
  }
  if (lista.items.length > 0) {
    return { pode: false, motivo: `A loja já tem ${lista.items.length} itens no cardápio da 99. O envio do Metrics substituiria esse cardápio, por isso só vale para loja nova. Nada foi enviado.` }
  }
  return { pode: true, motivo: 'A loja não tem cardápio na 99: o cardápio do Metrics pode ser enviado.' }
}

/** O endereço da página de autorização na resposta da 99 (o formato real é um objeto { url }; aceita texto e lista). */
export function urlDaAutorizacao(resposta: any): string | null {
  const d = resposta?.data
  const url = typeof d === 'string' ? d : Array.isArray(d) ? d[0] : d?.url
  return typeof url === 'string' && /^https:\/\//i.test(url) ? url : null
}
