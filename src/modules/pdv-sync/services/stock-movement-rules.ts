/**
 * Regras da rota POST /pdv/stocks (B0-02: estoque só pelo backend).
 *
 * 1) A baixa da venda é feita pelo próprio recebimento da venda (sales-sync-controller). Um PDV antigo ainda manda,
 *    também por /stocks, uma movimentação de saída "VENDA" para cada item vendido; aceitar essa movimentação faz a
 *    mesma venda baixar o estoque duas vezes. Por isso ela é ignorada aqui.
 * 2) Um motivo desconhecido (o PDV antigo manda EVASAO, ESTORNO_CANCELAMENTO_VENDA etc.) antes derrubava o lote
 *    INTEIRO com 400, e o PDV reenviava o mesmo lote para sempre. Agora só o movimento desconhecido é ignorado.
 * As demais movimentações (compra, ajuste, perda, quebra, cortesia, consumo interno, devolução) continuam aceitas.
 */
export const APPLICABLE_REASONS = [
    'COMPRA',
    'AJUSTE_POSITIVO',
    'AJUSTE_NEGATIVO',
    'DEVOLUCAO',
    'QUEBRA',
    'PERDA',
    'CORTESIA',
    'CONSUMO_INTERNO',
] as const

export interface IncomingStockMovement {
    type: 'IN' | 'OUT'
    reason: string
}

export function isLegacySaleMovement(mov: IncomingStockMovement): boolean {
    return mov.type === 'OUT' && mov.reason === 'VENDA'
}

export function isApplicableMovement(mov: IncomingStockMovement): boolean {
    return (APPLICABLE_REASONS as readonly string[]).includes(mov.reason)
}

export function splitStockMovements<T extends IncomingStockMovement>(
    movements: T[],
): { accepted: T[]; ignoredSales: T[]; ignoredUnknown: T[] } {
    const accepted: T[] = []
    const ignoredSales: T[] = []
    const ignoredUnknown: T[] = []
    for (const mov of movements) {
        if (isLegacySaleMovement(mov)) ignoredSales.push(mov)
        else if (isApplicableMovement(mov)) accepted.push(mov)
        else ignoredUnknown.push(mov) // inclui a entrada com motivo VENDA (estorno), que não é uma baixa nem um ajuste
    }
    return { accepted, ignoredSales, ignoredUnknown }
}
