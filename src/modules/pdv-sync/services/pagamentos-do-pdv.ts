/**
 * Formas, identificadores e maquininhas do PDV iguais aos da web (10/10/2026). Pedido do Thomás: "a sincronia entre as formas
 * de pagamento, os identificadores e as maquininhas deve ser orgânica entre o PDV e o backend". Decisões dele no mesmo dia:
 * a web é o único lugar de cadastro (o PDV só mostra); no PDV, a forma "A Prazo" pergunta "de quem" (os identificadores).
 *
 * Antes:
 * - a venda do PDV chegava à conferência com o nome do PDV ("Cartão de Crédito", "Vale Refeição (VR/Sodexo/Alelo)") e a
 *   conferência, que procura pelo nome do caixa da web ("Crédito", "Voucher"), não achava a taxa nem o prazo da maquininha;
 * - o identificador ia como "tipo" vazio (o PDV esperava um campo que a nuvem não mandava) e nunca aparecia no PDV;
 * - a maquininha era achada pelo nome que o PDV tinha, e o PDV oferecia todas as maquininhas em qualquer cartão.
 */

export type CategoriaDeCartao = 'CREDITO' | 'DEBITO' | 'PIX' | 'VOUCHER'

/** Sem acento, sem maiúscula, um espaço só. */
function normalizar(texto: string | null | undefined): string {
    return (texto ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/\s+/g, ' ').trim()
}

/**
 * A categoria de cartão de um nome de forma ou de taxa de maquininha: "Cartão de Crédito", "CRÉDITO", "CREDIT" e "crédito"
 * são crédito; "Vale Refeição", "VOUCHER" e "VR" são vale. Antes a conferência comparava o texto, e a taxa "CREDIT" (cadastrada
 * em inglês na loja de teste) nunca casava com "crédito".
 */
export function categoriaDeCartao(texto: string | null | undefined): CategoriaDeCartao | null {
    const t = normalizar(texto)
    if (!t) return null
    if (t.includes('pix')) return 'PIX'
    if (t.includes('credit')) return 'CREDITO'
    if (t.includes('debit')) return 'DEBITO'
    if (t.includes('voucher') || t.includes('vale') || t.includes('refeic') || t.includes('aliment') || /\b(vr|va)\b/.test(t)) return 'VOUCHER'
    return null
}

/** O que a maquininha aceita, pelas taxas cadastradas na web (sem taxa = o PDV oferece a maquininha em todo cartão). */
export function categoriasDaMaquininha(taxas: { payment_category: string | null }[]): CategoriaDeCartao[] {
    const set = new Set<CategoriaDeCartao>()
    for (const t of taxas) {
        const c = categoriaDeCartao(t.payment_category)
        if (c) set.add(c)
    }
    const ordem: CategoriaDeCartao[] = ['CREDITO', 'DEBITO', 'PIX', 'VOUCHER']
    return ordem.filter(c => set.has(c))
}

/** Tipo do identificador no formato do PDV: "CreditoLoja" (a prazo), "Evasao" (cortesia, pró-labore) ou vazio. */
export function tipoDoIdentificador(i: { is_correntista_debt: boolean; is_stock_evasion: boolean }): string {
    if (i.is_correntista_debt) return 'CreditoLoja'
    if (i.is_stock_evasion) return 'Evasao'
    return ''
}

/** Os nomes que o caixa da web usa (TransactionForm), para a venda do PDV e a da web caírem nas mesmas contas da conferência. */
const NOME_NA_CONFERENCIA: Record<string, string> = {
    dinheiro: 'Dinheiro',
    pix: 'PIX',
    debito: 'Débito',
    credito: 'Crédito',
    voucher: 'Voucher',
}

/**
 * O nome da forma no lançamento do caixa: o do identificador (Correntista, Funcionário, Permuta), quando houver; senão o do
 * caixa da web pela categoria do PDV (Dinheiro, PIX, Débito, Crédito, Voucher); senão o nome que veio do PDV (PDV antigo, ou
 * a forma a prazo sem identificador).
 */
export function metodoNaConferencia(pay: { Method: string; Categoria?: string | null }, nomeDoIdentificador?: string | null): string {
    const ident = (nomeDoIdentificador ?? '').trim()
    if (ident) return ident
    const porCategoria = NOME_NA_CONFERENCIA[normalizar(pay.Categoria)]
    return porCategoria ?? pay.Method
}
