/**
 * Regras da sessão de caixa da web (Caixa da Web e Conferência).
 * Situações gravadas: OPEN (aberto), PENDING (fechado, esperando conferência) e CHECKED (conferido).
 * 'CLOSED' e 'AUDITED' são nomes antigos que nenhum caminho grava hoje; continuam tratados como fechado e conferido.
 */

/** Situações em que o caixa já foi conferido. */
const CONFERIDO = ['CHECKED', 'AUDITED']
/** Situações em que o caixa já foi fechado e espera a conferência. */
const EM_CONFERENCIA = ['PENDING', 'CLOSED']

/**
 * Fase 1 do Mergulho (14:X1): a rota do saldo inicial só recusava 'CLOSED' e 'AUDITED', nomes que nunca são
 * gravados, e deixava mudar o fundo de troco de um caixa já fechado ou conferido.
 * Regra: caixa aberto, qualquer usuário logado; caixa em conferência, só o ADMIN (corrigir o fundo faz parte
 * da conferência); caixa conferido, ninguém (desfazer a conferência antes, para a quebra e o financeiro baterem).
 * Devolve a mensagem de recusa, ou null quando pode alterar.
 */
export function motivoParaNaoAlterarSaldoInicial(status: string | null | undefined, isAdmin: boolean): string | null {
    const s = (status || '').toUpperCase().trim()
    if (CONFERIDO.includes(s)) {
        return 'Este caixa já foi conferido: o saldo inicial não pode mudar. Desfaça a conferência antes de corrigir.'
    }
    if (EM_CONFERENCIA.includes(s) && !isAdmin) {
        return 'Este caixa já foi fechado e está em conferência: só o administrador pode corrigir o saldo inicial.'
    }
    return null
}

/** Marca que liga o vale do RH (payroll_entries) ao caixa que o gerou: "(Caixa <uuid da sessão>)". */
const MARCA_DO_CAIXA = /\(Caixa [0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\)/i

/**
 * Fase 4 do Mergulho (14:X4): o vale gerado pela conferência só se liga ao caixa pela marca no texto (não há coluna
 * para isso; ver relatório). Se o RH editar a descrição e apagar a marca, desfazer a conferência ou excluir o caixa
 * deixa o vale para trás e conferir de novo cria outro (vale em dobro). Ao editar, a marca volta para o fim do texto.
 */
export function manterMarcaDoCaixa(descricaoAtual: string | null | undefined, novaDescricao: string | undefined): string | undefined {
    if (novaDescricao === undefined) return undefined
    const marca = (descricaoAtual || '').match(MARCA_DO_CAIXA)?.[0]
    if (!marca || novaDescricao.includes(marca)) return novaDescricao
    return `${novaDescricao.trim()} ${marca}`
}
