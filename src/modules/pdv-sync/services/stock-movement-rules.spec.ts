import { describe, expect, it } from 'vitest'
import { codigoDoMovimento, isApplicableMovement, isLegacySaleMovement, splitStockMovements } from './stock-movement-rules'

describe('isLegacySaleMovement', () => {
    it('saída por venda é a movimentação duplicada que o PDV antigo manda', () => {
        expect(isLegacySaleMovement({ type: 'OUT', reason: 'VENDA' })).toBe(true)
    })

    it('entrada com motivo VENDA (estorno) não é a saída duplicada', () => {
        expect(isLegacySaleMovement({ type: 'IN', reason: 'VENDA' })).toBe(false)
    })
})

describe('isApplicableMovement', () => {
    it.each(['COMPRA', 'AJUSTE_POSITIVO', 'AJUSTE_NEGATIVO', 'DEVOLUCAO', 'QUEBRA', 'PERDA', 'CORTESIA', 'CONSUMO_INTERNO'])(
        'aceita %s',
        (reason) => {
            expect(isApplicableMovement({ type: 'IN', reason })).toBe(true)
        },
    )

    it.each(['EVASAO', 'ESTORNO_CANCELAMENTO_VENDA', 'DESPERDICIO_CANCELAMENTO_MESA', 'VENDA', ''])(
        'não aplica o motivo %s',
        (reason) => {
            expect(isApplicableMovement({ type: 'OUT', reason })).toBe(false)
        },
    )
})

describe('splitStockMovements', () => {
    it('separa o que aplica, a venda duplicada e o motivo desconhecido, sem perder nenhum', () => {
        const lote = [
            { type: 'OUT' as const, reason: 'VENDA', id: 1 },
            { type: 'IN' as const, reason: 'COMPRA', id: 2 },
            { type: 'OUT' as const, reason: 'VENDA', id: 3 },
            { type: 'OUT' as const, reason: 'QUEBRA', id: 4 },
            { type: 'OUT' as const, reason: 'EVASAO', id: 5 },
            { type: 'IN' as const, reason: 'ESTORNO_CANCELAMENTO_VENDA', id: 6 },
        ]

        const { accepted, ignoredSales, ignoredUnknown } = splitStockMovements(lote)

        expect(accepted.map((m) => m.id)).toEqual([2, 4])
        expect(ignoredSales.map((m) => m.id)).toEqual([1, 3])
        expect(ignoredUnknown.map((m) => m.id)).toEqual([5, 6])
        expect(accepted.length + ignoredSales.length + ignoredUnknown.length).toBe(lote.length)
    })

    it('um motivo desconhecido não impede os movimentos válidos do mesmo lote', () => {
        const { accepted } = splitStockMovements([
            { type: 'OUT' as const, reason: 'EVASAO' },
            { type: 'IN' as const, reason: 'COMPRA' },
        ])
        expect(accepted).toHaveLength(1)
    })

    it('lote vazio devolve listas vazias', () => {
        expect(splitStockMovements([])).toEqual({ accepted: [], ignoredSales: [], ignoredUnknown: [] })
    })
})

describe('codigoDoMovimento (02:P4: reenvio não mexe no estoque de novo)', () => {
    const mov = { productId: '7c9e6679-7425-40de-944b-e07fc1f90ae7', quantity: 2, type: 'OUT', reason: 'QUEBRA', createdAt: '2026-10-15T03:10:00.1234567Z' }

    it('o código que o PDV manda é o código da linha de estoque', () => {
        expect(codigoDoMovimento({ ...mov, uuid: 'AAAAAAAA-0000-4000-8000-000000000001' })).toBe('aaaaaaaa-0000-4000-8000-000000000001')
    })

    it('PDV antigo, sem código: o reenvio do mesmo movimento dá o mesmo código, em formato de UUID', () => {
        const a = codigoDoMovimento(mov)
        expect(a).toBe(codigoDoMovimento({ ...mov }))
        expect(a).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-5[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/)
    })

    it('outro movimento (quantidade, tipo ou hora diferente) dá outro código', () => {
        const a = codigoDoMovimento(mov)
        expect(codigoDoMovimento({ ...mov, quantity: 3 })).not.toBe(a)
        expect(codigoDoMovimento({ ...mov, type: 'IN' })).not.toBe(a)
        expect(codigoDoMovimento({ ...mov, createdAt: '2026-10-15T03:10:01Z' })).not.toBe(a)
    })

    it('sem a hora não dá para reconhecer o reenvio', () => {
        expect(codigoDoMovimento({ ...mov, createdAt: undefined })).toBeNull()
        expect(codigoDoMovimento({ ...mov, createdAt: 'não é data' })).toBeNull()
    })
})
