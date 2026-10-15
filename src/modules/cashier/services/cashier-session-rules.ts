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
