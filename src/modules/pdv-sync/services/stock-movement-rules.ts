import { createHash } from 'node:crypto'

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

/**
 * Código do movimento (Fase 2 do Mergulho, 02:P4, 15/10/2026). Antes o movimento não tinha código e cada envio virava uma
 * linha nova: se a resposta se perdesse e o PDV reenviasse, o estoque era baixado (ou somado) de novo.
 * 1) O PDV novo manda o código do próprio movimento (uuid): ele vira o código da linha de estoque na nuvem.
 * 2) PDV antigo, sem código: um código calculado do conteúdo (produto, quantidade, tipo, motivo e a hora exata em que o
 *    movimento foi feito). O reenvio do mesmo movimento dá o mesmo código. Sem a hora não dá para reconhecer o reenvio (null).
 */
export function codigoDoMovimento(mov: {
    uuid?: string | null
    productId: string | number
    quantity: number
    type: string
    reason: string
    createdAt?: string | null
}): string | null {
    if (mov.uuid) return mov.uuid.toLowerCase()
    if (!mov.createdAt) return null
    const instante = new Date(mov.createdAt)
    if (Number.isNaN(instante.getTime())) return null
    const conteudo = `estoque-pdv|${mov.productId}|${mov.quantity}|${mov.type}|${mov.reason}|${instante.toISOString()}`
    const h = createHash('sha1').update(conteudo).digest('hex')
    // Formato de UUID (versão 5, por nome), como as outras linhas de estoque
    return `${h.slice(0, 8)}-${h.slice(8, 12)}-5${h.slice(13, 16)}-${((parseInt(h[16], 16) & 0x3) | 0x8).toString(16)}${h.slice(17, 20)}-${h.slice(20, 32)}`
}
