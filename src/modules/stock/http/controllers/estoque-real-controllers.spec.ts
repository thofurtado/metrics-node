import { beforeEach, describe, expect, it, vi } from 'vitest'

// Etapa 4 do Vendas e Estoque (16/10/2026): o estoque de verdade pelas rotas, com banco de mentira.
const db: any = vi.hoisted(() => ({}))
vi.mock('@/lib/prisma', () => ({ prisma: db }))

import { getStockMovements, getStockOrigin } from './stock-history-controller'
import { getRecipeConsumption, getStockOverview, motivoDoAjuste, postAdjustStockBalance } from './stock-dashboard-controller'
import { motivoDoInventario, numeroDaChave, postConfirmNfe } from './nfe-stock-controller'
import { postSalesSync } from '@/modules/pdv-sync/http/controllers/sales-sync-controller'
import { postCancellationsSync } from '@/modules/pdv-sync/http/controllers/pdv-sync-controller'

function resposta() {
    const r: any = { code: 200, body: null }
    r.status = (c: number) => { r.code = c; return r }
    r.send = (b: any) => { r.body = b; return r }
    return r
}
function zerar() { for (const k of Object.keys(db)) delete db[k] }

const CAIXA = '33333333-3333-4333-8333-333333333333'
const VENDA = '44444444-4444-4444-8444-444444444441'
const ITEM = '77777777-7777-4777-8777-777777777771'
const PRODUTO = '55555555-5555-4555-8555-555555555551'
const PAO = '66666666-6666-4666-8666-666666666661'
const CARNE = '66666666-6666-4666-8666-666666666662'

describe('baixa da venda que sobe do PDV (D8)', () => {
    let tx: any
    const saldos: Record<string, number> = {}
    beforeEach(() => {
        zerar()
        for (const k of Object.keys(saldos)) delete saldos[k]
        saldos[PAO] = 10
        saldos[CARNE] = 2
        tx = {
            sale: { findUnique: vi.fn(async () => null), upsert: vi.fn(async () => ({})), update: vi.fn(), updateMany: vi.fn(async () => ({ count: 1 })) },
            cashierSession: { findUnique: vi.fn(async () => ({ status: 'OPEN' })) },
            cashierEntry: { findMany: vi.fn(async () => []), deleteMany: vi.fn(), create: vi.fn(), updateMany: vi.fn() },
            saleItem: { findMany: vi.fn(async () => []), findUnique: vi.fn(async () => null), create: vi.fn(), update: vi.fn() },
            clientTab: { findMany: vi.fn(async () => []), deleteMany: vi.fn(), update: vi.fn(), create: vi.fn() },
            employee: { findFirst: vi.fn(async () => null) },
            product: {
                findUnique: vi.fn(async ({ where }: any) => (where.id === PRODUTO ? {
                    id: PRODUTO, cost: 9, is_composite: true,
                    compositions: [
                        { supply_id: PAO, quantity: 1, supply: { cost: 1.5 } },
                        { supply_id: CARNE, quantity: 0.18, supply: { cost: 40 } },
                    ],
                } : null)),
                update: vi.fn(),
            },
            supply: {
                findUnique: vi.fn(async () => null),
                update: vi.fn(async ({ where, data }: any) => { saldos[where.id] -= data.stock.decrement; return { stock: saldos[where.id] } }),
            },
            complementOption: { findUnique: vi.fn(async () => null) },
            stock: { create: vi.fn(async ({ data }: any) => ({ id: `mov-${data.supply_id}`, ...data })) },
            cancellationAudit: { findFirst: vi.fn(async () => null) },
        }
        db.paymentIdentifier = { findMany: vi.fn(async () => []) }
        db.pOSMachine = { findMany: vi.fn(async () => []) }
        db.$transaction = vi.fn(async (fn: any) => fn(tx))
    })

    const venda = (extra: Record<string, any> = {}) => ({
        Uuid: VENDA, CashierSessionId: CAIXA, Origin: 'Balcao', TotalAmount: 60, Payments: [{ Method: 'Dinheiro', Amount: 60 }],
        Items: [{ Uuid: ITEM, ProductId: PRODUTO, Quantity: 2, UnitPrice: 30 }], ...extra,
    })

    it('produto com ficha baixa os insumos, cada linha ligada ao item e com o saldo logo depois', async () => {
        const r = resposta()
        await postSalesSync({ body: [venda()] } as any, r)
        expect(r.code).toBe(201)
        const linhas = tx.stock.create.mock.calls.map((c: any) => c[0].data)
        expect(linhas).toHaveLength(2)
        expect(linhas[0]).toMatchObject({ supply_id: PAO, quantity: 2, operation: 'OUT', description: 'VENDA', sale_item_id: ITEM, balance_after: 8, unit_cost: 1.5 })
        expect(linhas[1]).toMatchObject({ supply_id: CARNE, quantity: 0.36 })
        expect(linhas[1].balance_after).toBeCloseTo(1.64, 6)
        expect(tx.product.update).not.toHaveBeenCalled() // o próprio produto não é baixado
    })

    it('venda cancelada que ainda não tinha subido: baixa só se o operador escolheu desperdício', async () => {
        await postSalesSync({ body: [venda({ Status: 'CANCELLED', Payments: [] })] } as any, resposta())
        expect(tx.stock.create).not.toHaveBeenCalled()
        expect(tx.cancellationAudit.findFirst.mock.calls[0][0].where).toEqual({ item_id: ITEM, stock_destination: 'DESPERDICIO' })

        tx.cancellationAudit.findFirst = vi.fn(async () => ({ id: 'canc-1' }))
        await postSalesSync({ body: [venda({ Status: 'CANCELLED', Payments: [] })] } as any, resposta())
        expect(tx.stock.create).toHaveBeenCalledTimes(2)
    })
})

describe('cancelamento com "volta ao estoque" vira o estorno ligado à venda (D12)', () => {
    beforeEach(() => {
        zerar()
        db.cancellationAudit = {
            upsert: vi.fn(async () => ({})),
            findUnique: vi.fn(async () => ({ stock_restored: false })),
            update: vi.fn(async () => ({})),
        }
        db.sale = { findUnique: vi.fn(async () => ({ id: VENDA, cashier_session_id: CAIXA, status: 'COMPLETED' })), update: vi.fn((a: any) => a) }
        db.cashierSession = { findUnique: vi.fn(async () => ({ status: 'OPEN' })) }
        db.cashierEntry = { deleteMany: vi.fn((a: any) => a) }
        db.clientTab = { deleteMany: vi.fn((a: any) => a) }
        db.payrollEntry = { deleteMany: vi.fn((a: any) => a) }
        db.pedido = { findFirst: vi.fn(async () => null) }
        db.stock = {
            findMany: vi.fn(async () => [{ id: 'b1', quantity: 2, product_id: PRODUTO, supply_id: null, unit_cost: 3 }]),
            create: vi.fn(async ({ data }: any) => ({ id: 'est-1', ...data })),
        }
        db.product = { update: vi.fn(async () => ({ stock: 5 })) }
        db.$transaction = vi.fn(async (ops: any) => (typeof ops === 'function' ? ops(db) : ops))
    })

    const cancelamento = (destino: string) => ({
        Uuid: '22222222-2222-4222-8222-222222222222', PedidoUuid: VENDA, PedidoItemUuid: ITEM, ProdutoNome: 'Coca', Quantidade: 2,
        ValorUnitario: 5, ValorTotal: 10, TipoCancelamento: 'VENDA_COMPLETA', Motivo: 'Erro de lançamento', OrigemIdentificador: 'Venda #123',
        UsuarioId: 'u-joao', UsuarioNome: 'João', DataCancelamento: '2026-10-16T18:00:00.000Z', DestinoEstoque: destino,
    })

    it('ESTORNO: entrada "Estorno da venda #123" com quem cancelou, o cancelamento e o saldo depois; a escolha fica guardada', async () => {
        const r = resposta()
        await postCancellationsSync({ body: [cancelamento('ESTORNO')] } as any, r)
        expect(r.body.accepted).toHaveLength(1)
        expect(db.cancellationAudit.upsert.mock.calls[0][0].create.stock_destination).toBe('ESTORNO')
        expect(db.product.update.mock.calls[0][0]).toMatchObject({ where: { id: PRODUTO }, data: { stock: { increment: 2 } } })
        expect(db.stock.create.mock.calls[0][0].data).toMatchObject({
            operation: 'IN', description: 'DEVOLUCAO', quantity: 2, sale_item_id: ITEM, product_id: PRODUTO,
            note: 'Estorno da venda #123', user_name: 'João', user_id: 'u-joao', cancellation_id: '22222222-2222-4222-8222-222222222222', balance_after: 5,
        })
        expect(db.cancellationAudit.update).toHaveBeenCalledWith({ where: { id: '22222222-2222-4222-8222-222222222222' }, data: { stock_restored: true } })
    })

    it('DESPERDICIO: a baixa fica (sem estorno) e a escolha é guardada', async () => {
        await postCancellationsSync({ body: [cancelamento('DESPERDICIO')] } as any, resposta())
        expect(db.stock.create).not.toHaveBeenCalled()
        expect(db.cancellationAudit.upsert.mock.calls[0][0].update.stock_destination).toBe('DESPERDICIO')
    })
})

describe('extrato do Histórico (D6)', () => {
    beforeEach(() => {
        zerar()
        const linha = {
            id: 'm2', created_at: new Date('2026-10-16T15:00:00.000Z'), operation: 'OUT', description: 'VENDA', quantity: 1, unit_cost: 3,
            product_id: PRODUTO, supply_id: null, sale_item_id: ITEM, user_id: null, user_name: null, balance_after: null, note: null,
            document_key: null, document_number: null, cancellation_id: null, batch_number: null, supplier_cnpj: null, expiration_date: null,
            product: { id: PRODUTO, name: 'COCA COLA LATA', display_id: 174, measureUnit: 'UNITARY', stock: 9 },
            supply: null,
            saleItem: { id: ITEM, quantity: 1, sold_name: 'COCA COLA LATA', seller_name: null, sale: { id: VENDA, status: 'COMPLETED', origin: 'Balcao', origin_identifier: null, created_at: new Date(), cashierSession: { user_id: 'u-maria' } } },
        }
        db.stock = {
            count: vi.fn(async () => 1),
            findMany: vi.fn(async (args: any) => {
                if (args.include) return [linha]
                if (args.select?.balance_after) return [{ id: 'm2', product_id: PRODUTO, supply_id: null, operation: 'OUT', quantity: 1, balance_after: null }]
                if (args.select?.sale_item_id) return []
                return [{ operation: 'OUT', quantity: 1, unit_cost: 3 }]
            }),
        }
        db.user = { findMany: vi.fn(async () => [{ id: 'u-maria', name: 'Maria' }]) }
        db.cancellationAudit = { findMany: vi.fn(async () => []) }
        db.supplierProductMapping = { findMany: vi.fn(async () => []) }
        db.product = { findUnique: vi.fn(async () => null) }
        db.supply = { findUnique: vi.fn(async () => null) }
    })

    it('o filtro "SALE_PDV" da tela antiga acha as vendas; a linha traz tipo, saldo antes/depois, quem fez e a venda de origem', async () => {
        const r = resposta()
        await getStockMovements({ query: { period: 'all', eventType: 'SALE_PDV' } } as any, r)
        const where = db.stock.count.mock.calls[0][0].where
        expect(JSON.stringify(where)).toContain('"description":"VENDA"')
        expect(r.body.movements[0]).toMatchObject({
            kind: 'VENDA', label: 'Venda', delta: -1, balanceBefore: 10, balanceAfter: 9, balanceCalculated: true,
            who: 'Maria (caixa)', origin: { tipo: 'VENDA', id: VENDA }, item: { name: 'COCA COLA LATA', code: 174, unit: 'un' },
        })
        // Totais do que está filtrado, nunca números de exemplo
        expect(r.body.summary).toMatchObject({ totalCount: 1, totalEntriesValue: 0, totalExitsValue: 3 })
    })

    it('sem movimento no período: lista vazia e totais zerados', async () => {
        db.stock.count = vi.fn(async () => 0)
        db.stock.findMany = vi.fn(async () => [])
        const r = resposta()
        await getStockMovements({ query: {} } as any, r)
        expect(r.body.movements).toEqual([])
        expect(r.body.summary).toMatchObject({ totalCount: 0, totalEntriesValue: 0, totalExitsValue: 0 })
    })

    it('a nota de compra que não está no estoque responde 404 com a frase', async () => {
        db.stock.findMany = vi.fn(async () => [])
        const r = resposta()
        await getStockOrigin({ query: { type: 'NFE', id: 'CHAVE' } } as any, r)
        expect(r.code).toBe(404)
        expect(r.body.message).toBe('Nota de compra não encontrada no estoque.')
    })
})

describe('Ficha Técnica e Posição só com dado real', () => {
    beforeEach(() => {
        zerar()
        db.composition = { findMany: vi.fn(async () => []) }
        db.complementOption = { findMany: vi.fn(async () => []) }
        db.stock = { findMany: vi.fn(async () => []) }
        db.supply = { findMany: vi.fn(async () => []) }
        db.product = { findMany: vi.fn(async () => []) }
    })

    it('sem ficha técnica nem complemento ligado: nada inventado (antes vinham "vendas de demonstração")', async () => {
        const r = resposta()
        await getRecipeConsumption({ query: { period: 'today' } } as any, r)
        expect(r.body).toEqual({ period: 'today', recipesCount: 0, linkedOptionsCount: 0, supplies: [] })
    })

    it('Posição: produto sem estoque mínimo no cadastro não "acaba"; produto com ficha não aparece (quem baixa são os insumos)', async () => {
        db.product.findMany = vi.fn(async () => [
            { id: 'p1', name: 'B', display_id: 2, stock: 5, min_stock: 0, cost: 1, price: 2, measureUnit: 'UNITARY', category: null, stocks: [] },
            { id: 'p2', name: 'A', display_id: 1, stock: 0.5, min_stock: 1, cost: 1, price: 2, measureUnit: 'FRACTIONAL', category: { name: 'Padaria' }, stocks: [] },
        ])
        const r = resposta()
        await getStockOverview({ query: {} } as any, r)
        expect(r.body.items.map((i: any) => [i.name, i.situation, i.minStock, i.unit])).toEqual([['A', 'WARNING', 1, 'kg'], ['B', 'NORMAL', null, 'un']])
        expect(JSON.stringify(db.product.findMany.mock.calls[0][0].where)).toContain('"NOT":{"AND":[{"is_composite":true},{"compositions":{"some":{}}}]}')
        expect(r.body.categories).toEqual(['Padaria', 'Sem categoria'])
    })
})

describe('ajuste, inventário e entrada de nota', () => {
    beforeEach(() => zerar())

    it('o motivo do ajuste combina com a direção', () => {
        expect(motivoDoAjuste('AJUSTE_POSITIVO', -2)).toEqual({ motivo: 'AJUSTE_NEGATIVO' })
        expect(motivoDoAjuste('QUEBRA', -1)).toEqual({ motivo: 'QUEBRA' })
        expect(motivoDoAjuste('QUEBRA', 1)).toHaveProperty('erro')
        expect(motivoDoAjuste('COMPRA', -1)).toHaveProperty('erro')
        expect(motivoDoInventario(2, 'QUEBRA')).toBe('AJUSTE_POSITIVO')
        expect(motivoDoInventario(-2, 'QUEBRA')).toBe('QUEBRA')
        expect(motivoDoInventario(-2, null)).toBe('AJUSTE_NEGATIVO') // antes toda falta virava "quebra"
        expect(numeroDaChave('35261012345678000199550010000012341000012345')).toBe('1234')
        expect(numeroDaChave('123')).toBeNull()
    })

    it('ajuste grava o saldo exato com quem ajustou e o motivo', async () => {
        db.product = { findUnique: vi.fn(async () => ({ name: 'Coca', stock: 10, cost: 3 })), update: vi.fn(async () => ({ stock: 7 })) }
        db.user = { findUnique: vi.fn(async () => ({ id: 'u1', name: 'Thomás' })) }
        db.stock = { create: vi.fn(async ({ data }: any) => ({ id: 'a1', ...data })) }
        db.$transaction = vi.fn(async (fn: any) => fn(db))
        const r = resposta()
        await postAdjustStockBalance({ body: { targetId: PRODUTO, targetType: 'PRODUCT', newStock: 7, reason: 'QUEBRA', notes: 'garrafa caiu' }, user: { sub: 'u1' } } as any, r)
        expect(r.code).toBe(200)
        expect(db.product.update.mock.calls[0][0].data).toEqual({ stock: 7 })
        expect(db.stock.create.mock.calls[0][0].data).toMatchObject({
            operation: 'OUT', quantity: 3, description: 'QUEBRA', user_name: 'Thomás', balance_after: 7, note: 'Quebra / avaria: garrafa caiu',
        })
    })

    const nota = (extra: Record<string, any> = {}) => ({
        header: { chaveNfe: '35261012345678000199550010000012341000012345', numeroNfe: '1234', fornecedor: { cnpj: '12345678000199', razaoSocial: 'Distribuidora X' } },
        items: [{ supplierProductCode: 'A1', supplierProductName: 'Pão (cx 10)', supplierUnit: 'CX', supplierQuantity: 2, stockQuantity: 20, supplierUnitPrice: 15, targetType: 'SUPPLY', targetId: PAO, conversionFactor: 10 }],
        ...extra,
    })

    it('a mesma nota não entra duas vezes', async () => {
        db.stock = { findFirst: vi.fn(async () => ({ created_at: new Date('2026-10-16T13:00:00.000Z'), user_name: 'Ana' })) }
        db.user = { findUnique: vi.fn(async () => null) }
        const r = resposta()
        await postConfirmNfe({ body: nota() } as any, r)
        expect(r.code).toBe(409)
        expect(r.body.message).toContain('por Ana')
    })

    it('entra com a nota, quem deu entrada, a quantidade já convertida e o custo por unidade do estoque', async () => {
        db.stock = { findFirst: vi.fn(async () => null), create: vi.fn(async ({ data }: any) => ({ id: 'c1', ...data })) }
        db.user = { findUnique: vi.fn(async () => ({ id: 'u1', name: 'Thomás' })) }
        db.supply = { findUnique: vi.fn(async () => ({ id: PAO })), update: vi.fn(async () => ({ stock: 30 })) }
        db.supplierProductMapping = { upsert: vi.fn(async () => ({})) }
        db.$transaction = vi.fn(async (fn: any) => fn(db))
        const r = resposta()
        await postConfirmNfe({ body: nota(), user: { sub: 'u1' } } as any, r)
        expect(r.code).toBe(201)
        expect(db.supply.update.mock.calls[0][0].data).toEqual({ stock: { increment: 20 }, cost: 1.5 })
        expect(db.stock.create.mock.calls[0][0].data).toMatchObject({
            operation: 'IN', description: 'COMPRA', quantity: 20, unit_cost: 1.5, supply_id: PAO, user_name: 'Thomás', balance_after: 30,
            document_key: '35261012345678000199550010000012341000012345', document_number: '1234', supplier_cnpj: '12345678000199',
        })
    })

    it('item sem produto/insumo que exista: recusa com o nome, nada entra', async () => {
        db.stock = { findFirst: vi.fn(async () => null), create: vi.fn() }
        db.user = { findUnique: vi.fn(async () => null) }
        db.supply = { findUnique: vi.fn(async () => null) }
        db.$transaction = vi.fn()
        const r = resposta()
        await postConfirmNfe({ body: nota() } as any, r)
        expect(r.code).toBe(400)
        expect(r.body.message).toContain('Pão (cx 10)')
        expect(db.$transaction).not.toHaveBeenCalled()
    })
})
