/**
 * Situação do saldo na Posição de Estoque (etapa 4, 16/10/2026). Antes o estoque mínimo era INVENTADO pela unidade (15 kg,
 * 24 un, 4 garrafas...) e o produto "acabava" com menos de 24 unidades mesmo com o mínimo do cadastro vazio.
 * Agora: zerado ou negativo = CRITICAL; abaixo do mínimo DO CADASTRO (produto; o insumo não tem mínimo) = WARNING; o resto, NORMAL.
 * A venda nunca trava por isso (D5): é só aviso para quem compra.
 */
export type SituacaoDoSaldo = 'NORMAL' | 'WARNING' | 'CRITICAL'

export function situacaoDoSaldo(saldo: number, minimo: number | null | undefined): SituacaoDoSaldo {
    if (!(saldo > 0)) return 'CRITICAL'
    if (typeof minimo === 'number' && minimo > 0 && saldo <= minimo) return 'WARNING'
    return 'NORMAL'
}
