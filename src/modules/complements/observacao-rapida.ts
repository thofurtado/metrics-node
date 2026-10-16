/**
 * Observação rápida (só no salão), decisão do Thomás em 16/10/2026 (PLANO-GARCOM-CLASSE-A.md, seção 4).
 *
 * Um grupo de complementos marcado (coluna complement_groups.quick_note) é ligado aos produtos como qualquer grupo ("Gelo e
 * limão" nos refrigerantes, "Sem cebola" nas pizzas), mas:
 *  - as opções têm SEMPRE preço zero (a nuvem zera ao salvar e de novo ao mandar ao PDV);
 *  - NUNCA aparece para o cliente: cardápio online (/public/menu sem a chave do PDV), conferência de preço do pedido do
 *    cardápio (06:C6) e o cardápio enviado ao iFood/99;
 *  - no PDV e no app do garçom vira botões de observação com contador (o PDV recebe o grupo pelo /public/menu com a chave
 *    x-api-key e o campo "observacaoRapida"; contrato em _claude-sync/relatorios/CONTRATO-GARCOM-CLASSE-A.md).
 */

/** Filtro do Prisma para os grupos que o cliente pode ver (cardápio online, conferência do pedido, iFood/99). */
export const GRUPO_DO_CLIENTE = { quick_note: false } as const

/** Preço que a opção grava e manda: no grupo de observação rápida é sempre zero. */
export function precoDaOpcao(observacaoRapida: boolean | null | undefined, preco: number | null | undefined): number {
    if (observacaoRapida === true) return 0
    const valor = Number(preco)
    return Number.isFinite(valor) ? valor : 0
}

/** Tira os grupos de observação rápida de uma lista (para o que vai ao cliente ou às plataformas). */
export function semObservacaoRapida<T extends { quick_note?: boolean | null }>(grupos: T[]): T[] {
    return grupos.filter((g) => g.quick_note !== true)
}

/**
 * O banco da loja ainda não tem a coluna (o Sincronizar do SaaS Admin não rodou depois da 2.6.126.0). Quem é do cliente
 * (cardápio online e conferência do pedido) consulta de novo sem a coluna, e aí nenhum grupo está marcado.
 */
export function colunaObservacaoRapidaAusente(err: unknown): boolean {
    const e = err as { code?: string; message?: string; meta?: { column?: string } } | null
    if (!e) return false
    const texto = `${e.message ?? ''} ${e.meta?.column ?? ''}`
    return (e.code === 'P2022' || /does not exist|não existe/i.test(texto)) && texto.includes('quick_note')
}
