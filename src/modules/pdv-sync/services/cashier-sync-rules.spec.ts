import { describe, expect, it } from 'vitest'
import {
    SyncRejection,
    acceptsChanges,
    buildSaleEntries,
    checkSaleSession,
    chooseSaleSessionId,
    isPlaceholderFromClose,
    isTermPayment,
    saleEntryTag,
    saleFieldsChanged,
    normalizeCounted,
    sameEntries,
    shouldApplyClose,
    shouldReverseStock,
    terminalToStore,
} from './cashier-sync-rules'

const SALE = '1f9408ee-8adf-4566-8d61-127896f99733'

describe('chooseSaleSessionId', () => {
    it('venda nova fica no caixa informado pelo PDV', () => {
        expect(chooseSaleSessionId('caixa-pdv', null)).toBe('caixa-pdv')
    })

    it('venda que já existe nunca muda de caixa, mesmo se o PDV mandar outro', () => {
        expect(chooseSaleSessionId('outro-caixa', 'caixa-original')).toBe('caixa-original')
    })

    it('venda antiga sem caixa recebe o caixa informado', () => {
        expect(chooseSaleSessionId('caixa-pdv', null)).toBe('caixa-pdv')
    })

    it('sem caixa nenhum não inventa caixa', () => {
        expect(chooseSaleSessionId(null, null)).toBeNull()
        expect(chooseSaleSessionId(undefined, undefined)).toBeNull()
    })
})

describe('checkSaleSession', () => {
    it('venda sem caixa é recusada (antes caía no caixa aberto mais recente de qualquer terminal)', () => {
        expect(checkSaleSession(null, null, true)).toBe('VENDA_SEM_CAIXA')
    })

    it('caixa que ainda não existe na nuvem recusa a venda', () => {
        expect(checkSaleSession('caixa', null, true)).toBe('CAIXA_NAO_ENVIADO')
    })

    it.each(['OPEN', 'PENDING'])('caixa %s aceita venda nova e alteração (venda atrasada fica no caixa dela)', (status) => {
        expect(checkSaleSession('caixa', { status }, true)).toBeNull()
    })

    it('caixa conferido recusa venda nova ou alteração', () => {
        expect(checkSaleSession('caixa', { status: 'CHECKED' }, true)).toBe('CAIXA_JA_CONFERIDO')
    })

    it('caixa conferido aceita reenvio idêntico sem mexer em nada', () => {
        expect(checkSaleSession('caixa', { status: 'CHECKED' }, false)).toBeNull()
    })
})

describe('acceptsChanges', () => {
    it('só caixa existente e não conferido aceita mudanças', () => {
        expect(acceptsChanges({ status: 'OPEN' })).toBe(true)
        expect(acceptsChanges({ status: 'PENDING' })).toBe(true)
        expect(acceptsChanges({ status: 'CHECKED' })).toBe(false)
        expect(acceptsChanges(null)).toBe(false)
    })
})

describe('buildSaleEntries', () => {
    it('um pagamento: mesmo texto usado desde sempre', () => {
        expect(buildSaleEntries(SALE, 'Balcao', 'COMPLETED', [{ Method: 'Pix', Amount: 121.8 }])).toEqual([
            { identification: 'Balcao - Pedido #1f9408ee', payment_method: 'Pix', amount: 121.8 },
        ])
    })

    it('vários pagamentos: numerados e com a forma no texto', () => {
        expect(buildSaleEntries(SALE, 'Balcao', 'COMPLETED', [
            { Method: 'Débito', Amount: 76.5 },
            { Method: 'Dinheiro', Amount: 100 },
        ])).toEqual([
            { identification: 'Balcao - Pedido #1f9408ee [1/2] (Débito)', payment_method: 'Débito', amount: 76.5 },
            { identification: 'Balcao - Pedido #1f9408ee [2/2] (Dinheiro)', payment_method: 'Dinheiro', amount: 100 },
        ])
    })

    it('pagamento zerado não gera lançamento (numeração igual à antiga)', () => {
        const entries = buildSaleEntries(SALE, 'Mesa', 'COMPLETED', [
            { Method: 'Pix', Amount: 0 },
            { Method: 'Dinheiro', Amount: 50 },
        ])
        expect(entries).toEqual([{ identification: 'Mesa - Pedido #1f9408ee [1/2] (Dinheiro)', payment_method: 'Dinheiro', amount: 50 }])
    })

    it('sem origem usa PDV', () => {
        expect(buildSaleEntries(SALE, null, 'COMPLETED', [{ Method: 'Pix', Amount: 1 }])[0].identification).toBe('PDV - Pedido #1f9408ee')
    })

    it('venda cancelada não tem lançamento', () => {
        expect(buildSaleEntries(SALE, 'Balcao', 'CANCELLED', [{ Method: 'Pix', Amount: 10 }])).toEqual([])
    })

    it('a marca da venda está em todo lançamento dela', () => {
        const tag = saleEntryTag(SALE)
        for (const e of buildSaleEntries(SALE, 'Balcao', 'COMPLETED', [{ Method: 'Pix', Amount: 1 }, { Method: 'Dinheiro', Amount: 2 }])) {
            expect(e.identification).toContain(tag)
        }
    })
})

describe('sameEntries', () => {
    const a = { identification: 'Balcao - Pedido #1f9408ee', payment_method: 'Pix', amount: 121.8 }

    it('reenvio igual não troca nada', () => {
        expect(sameEntries([a], [{ ...a }])).toBe(true)
    })

    it('diferença abaixo de um centavo é igual', () => {
        expect(sameEntries([{ ...a, amount: 121.8000001 }], [a])).toBe(true)
    })

    it('forma de pagamento trocada (um pagamento só: antes não chegava à nuvem)', () => {
        expect(sameEntries([a], [{ ...a, payment_method: 'Dinheiro' }])).toBe(false)
    })

    it('valor trocado', () => {
        expect(sameEntries([a], [{ ...a, amount: 120 }])).toBe(false)
    })

    it('quantidade diferente de lançamentos (antes duplicava ao trocar a forma com vários pagamentos)', () => {
        expect(sameEntries([a, a], [a])).toBe(false)
        expect(sameEntries([], [a])).toBe(false)
    })

    it('ordem não importa', () => {
        const b = { identification: 'x [2/2] (Dinheiro)', payment_method: 'Dinheiro', amount: 5 }
        expect(sameEntries([a, b], [b, a])).toBe(true)
    })
})

describe('saleFieldsChanged', () => {
    const stored = { total_amount: 50, discount: 0, status: 'COMPLETED' }

    it('mesmos valores', () => {
        expect(saleFieldsChanged(stored, { TotalAmount: 50, Discount: 0, Status: 'COMPLETED' })).toBe(false)
        expect(saleFieldsChanged({ ...stored, discount: null }, { TotalAmount: 50, Discount: 0, Status: 'COMPLETED' })).toBe(false)
    })

    it('cancelamento, total ou desconto mudam a venda', () => {
        expect(saleFieldsChanged(stored, { TotalAmount: 50, Discount: 0, Status: 'CANCELLED' })).toBe(true)
        expect(saleFieldsChanged(stored, { TotalAmount: 45, Discount: 5, Status: 'COMPLETED' })).toBe(true)
    })
})

describe('isTermPayment', () => {
    it.each(['A Prazo', 'A Prazo (Correntista)', 'Fiado'])('%s é fiado', (m) => expect(isTermPayment(m)).toBe(true))
    it.each(['Dinheiro', 'Pix', null])('%s não é fiado', (m) => expect(isTermPayment(m)).toBe(false))
})

describe('isPlaceholderFromClose', () => {
    const t = new Date('2026-09-20T04:34:46.735Z')
    const placeholder = { status: 'PENDING', period: 'Caixa PDV', initial_balance: 0, opened_at: t, closed_at: t }

    it('reconhece o caixa criado pelo fechamento sem abertura', () => {
        expect(isPlaceholderFromClose(placeholder)).toBe(true)
    })

    it('caixa conferido não é corrigido', () => {
        expect(isPlaceholderFromClose({ ...placeholder, status: 'CHECKED' })).toBe(false)
    })

    it('caixa normal não é confundido', () => {
        expect(isPlaceholderFromClose({ ...placeholder, period: 'Turno 02' })).toBe(false)
        expect(isPlaceholderFromClose({ ...placeholder, initial_balance: 150 })).toBe(false)
        expect(isPlaceholderFromClose({ ...placeholder, opened_at: new Date('2026-09-19T04:29:22Z') })).toBe(false)
        expect(isPlaceholderFromClose({ ...placeholder, closed_at: null })).toBe(false)
    })
})

describe('shouldApplyClose', () => {
    it('só caixa aberto vai para conferência', () => {
        expect(shouldApplyClose('OPEN')).toBe(true)
    })

    it.each(['PENDING', 'CHECKED'])('reenvio do fechamento não mexe em caixa %s', (status) => {
        expect(shouldApplyClose(status)).toBe(false)
    })
})

describe('SyncRejection', () => {
    it('resposta com mensagem em português primeiro, código e referência', () => {
        const r = new SyncRejection('CAIXA_JA_CONFERIDO', SALE).toResponse()
        expect(r.code).toBe('CAIXA_JA_CONFERIDO')
        expect(r.message.startsWith('O caixa já foi conferido')).toBe(true)
        expect(r.message).toContain('(1f9408ee)')
        expect(r.ref).toBe(SALE)
    })
})

describe('terminalToStore', () => {
    it('caixa da web sem terminal passa a ter o terminal do PDV que o vinculou', () => {
        expect(terminalToStore(null, 'CAIXA-01')).toBe('CAIXA-01')
    })

    it('terminal já gravado nunca é trocado', () => {
        expect(terminalToStore('CAIXA-01', 'CAIXA-02')).toBe('CAIXA-01')
    })

    it('terminal vazio não é gravado', () => {
        expect(terminalToStore(null, '  ')).toBeNull()
        expect(terminalToStore(undefined, undefined)).toBeNull()
    })
})

describe('normalizeCounted', () => {
    it('guarda o contado por forma em centavos', () => {
        expect(normalizeCounted({ Dinheiro: 480.004, Pix: '121.8' })).toEqual({ Dinheiro: 480, Pix: 121.8 })
    })

    it('ignora valor que não é número e forma sem nome', () => {
        expect(normalizeCounted({ Dinheiro: 'abc', '': 10, Débito: 76.5 })).toEqual({ Débito: 76.5 })
    })

    it('sem contado nenhum fica vazio', () => {
        expect(normalizeCounted(null)).toBeNull()
        expect(normalizeCounted({})).toBeNull()
    })
})

describe('shouldReverseStock', () => {
    it('"Devolver ao Estoque" devolve uma vez', () => {
        expect(shouldReverseStock('ESTORNO', false)).toBe(true)
        expect(shouldReverseStock('estorno', false)).toBe(true)
        expect(shouldReverseStock('ESTORNO', true)).toBe(false)
    })

    it('"Registrar como Desperdício" mantém a saída', () => {
        expect(shouldReverseStock('DESPERDICIO', false)).toBe(false)
    })

    it('PDV antigo, sem a escolha, não devolve (como antes)', () => {
        expect(shouldReverseStock(null, false)).toBe(false)
        expect(shouldReverseStock(undefined, false)).toBe(false)
    })
})
