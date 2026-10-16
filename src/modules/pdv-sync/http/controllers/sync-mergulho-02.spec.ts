import { beforeEach, describe, expect, it, vi } from 'vitest'

// Mergulho, ligação 02 (PDV ⇄ nuvem): estoque reenviado (P4), a prazo de outra venda (P7), mesas fechadas (P10) e o lote
// de vendas que diz o que aceitou (P11).
const db: any = vi.hoisted(() => ({}))
vi.mock('@/lib/prisma', () => ({ prisma: db }))

import { postCancellationsSync, postStocksSync } from './pdv-sync-controller'
import { postSalesSync } from './sales-sync-controller'
import { postTablesSync } from './tables-sync-controller'

function resposta() {
    const r: any = { code: 0, body: null }
    r.status = (c: number) => { r.code = c; return r }
    r.send = (b: any) => { r.body = b; return r }
    return r
}

function zerar() {
    for (const k of Object.keys(db)) delete db[k]
}

describe('movimento de estoque reenviado (02:P4)', () => {
    const linhas = new Map<string, any>()
    beforeEach(() => {
        zerar()
        linhas.clear()
        db.product = {
            findFirst: vi.fn(async () => ({ id: 'prod-1', cost: 4 })),
            update: vi.fn(async () => ({ stock: 8 })),
        }
        db.stock = {
            findUnique: vi.fn(async ({ where }: any) => linhas.get(where.id) ?? null),
            create: vi.fn(async ({ data }: any) => { linhas.set(data.id, data); return data }),
        }
        // Desde a etapa 4 (16/10/2026) o movimento passa por registrarMovimento numa transação interativa
        db.__emTransacao = false
        db.$transaction = vi.fn(async (fn: any) => {
            db.__emTransacao = true
            try { return await fn(db) } finally { db.__emTransacao = false }
        })
    })

    const lote = [{ uuid: '11111111-1111-4111-8111-111111111111', productId: '7c9e6679-7425-40de-944b-e07fc1f90ae7', quantity: 2, type: 'OUT', reason: 'QUEBRA', createdAt: '2026-10-15T03:10:00Z' }]

    it('o mesmo movimento enviado duas vezes baixa o estoque uma vez só', async () => {
        const r1 = resposta()
        await postStocksSync({ body: lote } as any, r1)
        const r2 = resposta()
        await postStocksSync({ body: lote } as any, r2)

        expect(db.product.update).toHaveBeenCalledTimes(1)
        expect(r1.body).toMatchObject({ applied: 1, repeated: 0, accepted: [lote[0].uuid] })
        expect(r2.body).toMatchObject({ applied: 0, repeated: 1, accepted: [lote[0].uuid] })
    })

    it('PDV antigo (sem código) também é reconhecido no reenvio, pela hora do movimento', async () => {
        const semCodigo = [{ ...lote[0], uuid: undefined }]
        await postStocksSync({ body: semCodigo } as any, resposta())
        await postStocksSync({ body: semCodigo } as any, resposta())
        expect(db.product.update).toHaveBeenCalledTimes(1)
    })

    it('a linha de estoque e o saldo do produto mudam juntos (transação), com o saldo logo depois na linha', async () => {
        const dentro: boolean[] = []
        db.product.update = vi.fn(async () => { dentro.push(db.__emTransacao); return { stock: 8 } })
        db.stock.create = vi.fn(async ({ data }: any) => { dentro.push(db.__emTransacao); linhas.set(data.id, data); return data })
        await postStocksSync({ body: lote } as any, resposta())
        expect(db.$transaction).toHaveBeenCalledTimes(1)
        expect(dentro).toEqual([true, true])
        expect(db.product.update.mock.calls[0][0]).toMatchObject({ where: { id: 'prod-1' }, data: { stock: { decrement: 2 } } })
        expect(db.stock.create.mock.calls[0][0].data).toMatchObject({
            id: lote[0].uuid, product_id: 'prod-1', operation: 'OUT', description: 'QUEBRA', quantity: 2, balance_after: 8, unit_cost: 4,
        })
    })

    it('produto que não existe na nuvem não é marcado como aceito', async () => {
        db.product.findFirst = vi.fn(async () => null)
        const r = resposta()
        await postStocksSync({ body: lote } as any, r)
        expect(r.body.accepted).toEqual([])
        expect(r.body.ignored).toEqual([{ uuid: lote[0].uuid, reason: 'PRODUTO_NAO_ENCONTRADO' }])
    })
})

describe('cancelar uma venda não apaga o a prazo de outra (02:P7)', () => {
    beforeEach(() => {
        zerar()
        db.cancellationAudit = { upsert: vi.fn(async () => ({})), findUnique: vi.fn(async () => null) }
        db.sale = { findUnique: vi.fn(async () => ({ id: 'v', cashier_session_id: 'caixa-A', status: 'COMPLETED' })), update: vi.fn((a: any) => a) }
        db.cashierSession = { findUnique: vi.fn(async () => ({ status: 'OPEN' })) }
        db.cashierEntry = { deleteMany: vi.fn((a: any) => a) }
        db.clientTab = { deleteMany: vi.fn((a: any) => a) }
        db.payrollEntry = { deleteMany: vi.fn((a: any) => a) }
        db.pedido = { findFirst: vi.fn(async () => null) }
        db.$transaction = vi.fn(async (ops: any) => (typeof ops === 'function' ? ops(db) : ops))
    })

    it('só tira a conta a prazo do caixa da venda cancelada', async () => {
        const r = resposta()
        await postCancellationsSync({
            body: [{ Uuid: '22222222-2222-4222-8222-222222222222', PedidoUuid: '1f9408ee-0000-4000-8000-000000000001', ProdutoNome: 'X', Quantidade: 1, ValorUnitario: 10, ValorTotal: 10, TipoCancelamento: 'VENDA_COMPLETA', Motivo: 'teste' }],
        } as any, r)

        expect(r.body.accepted).toHaveLength(1)
        const filtroDaConta = db.clientTab.deleteMany.mock.calls[0][0].where
        expect(filtroDaConta.cashier_session_id).toBe('caixa-A')
        expect(filtroDaConta.description).toEqual({ contains: 'Pedido #1f9408ee' })
        // Lançamento pelo texto, só o antigo (sem a venda gravada)
        const filtroDoLancamento = db.cashierEntry.deleteMany.mock.calls[0][0].where
        expect(filtroDoLancamento.OR[1]).toMatchObject({ sale_id: null })
    })
})

describe('lote de vendas (02:P7 e 02:P11)', () => {
    beforeEach(() => {
        zerar()
        const tx: any = {
            sale: { findUnique: vi.fn(async () => null), upsert: vi.fn(async () => ({})) },
            cashierSession: { findUnique: vi.fn(async () => ({ status: 'OPEN' })) },
            cashierEntry: { findMany: vi.fn(async () => []), deleteMany: vi.fn(), create: vi.fn() },
            saleItem: { findMany: vi.fn(async () => []), findUnique: vi.fn(async () => ({ id: 'ja-existe' })) },
            clientTab: { findMany: vi.fn(async () => []), deleteMany: vi.fn(), update: vi.fn(), create: vi.fn() },
        }
        db.__tx = tx
        db.$transaction = vi.fn(async (fn: any) => fn(tx))
    })

    const venda = (uuid: string) => ({ Uuid: uuid, CashierSessionId: '33333333-3333-4333-8333-333333333333', TotalAmount: 10, Items: [], Payments: [] })

    it('a resposta diz quais vendas foram aceitas', async () => {
        const r = resposta()
        const uuids = ['44444444-4444-4444-8444-444444444441', '44444444-4444-4444-8444-444444444442']
        await postSalesSync({ body: uuids.map(venda) } as any, r)
        expect(r.code).toBe(201)
        expect(r.body.accepted).toEqual(uuids)
    })

    it('a conta a prazo da venda é procurada só no caixa dela', async () => {
        await postSalesSync({ body: [venda('44444444-4444-4444-8444-444444444441')] } as any, resposta())
        const filtro = db.__tx.clientTab.findMany.mock.calls[0][0].where
        expect(filtro.cashier_session_id).toBe('33333333-3333-4333-8333-333333333333')
    })
})

describe('mesa fechada sai das mesas ativas (02:P10)', () => {
    beforeEach(() => {
        zerar()
        db.activeTable = { upsert: vi.fn(async () => ({ id: 'm1' })), deleteMany: vi.fn(async () => ({ count: 0 })) }
        db.activeTableItem = { deleteMany: vi.fn(), create: vi.fn() }
    })

    it('a mesa que não veio na foto do PDV sai, menos a que tem item do garçom pela nuvem', async () => {
        await postTablesSync({ body: [{ identificador: 'Mesa 01', status: 'Ocupada' }], headers: {} } as any, resposta())
        const limpeza = db.activeTable.deleteMany.mock.calls.at(-1)![0].where
        expect(limpeza.identifier).toEqual({ notIn: ['Mesa 01'] })
        expect(limpeza.items).toEqual({ none: { waiter_name: { not: null } } })
    })

    it('foto vazia (nenhuma mesa aberta) tira todas as do PDV', async () => {
        await postTablesSync({ body: [], headers: {} } as any, resposta())
        expect(db.activeTable.deleteMany.mock.calls.at(-1)![0].where.identifier).toEqual({ notIn: [] })
    })
})
