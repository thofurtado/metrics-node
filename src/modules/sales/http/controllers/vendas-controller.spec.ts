import { beforeEach, describe, expect, it, vi } from 'vitest'

// Rotas do módulo Vendas (etapas 2 e 3, 16/10/2026) com o banco de mentira: só leem, nunca gravam.
const db: any = vi.hoisted(() => ({}))
vi.mock('@/lib/prisma', () => ({ prisma: db }))

import {
    getCancelamentosDasVendas,
    getContaDasVendas,
    getDetalheDaVenda,
    getFiltrosDasVendas,
    getListaDeVendas,
    getProdutosVendidos,
    getVendedoresDoPeriodo,
} from './vendas-controller'

function resposta() {
    const r: any = { code: 0, body: null }
    r.status = (c: number) => { r.code = c; return r }
    r.send = (b: any) => { r.body = b; return r }
    return r
}

const ADMIN = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
const OPERADOR = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'
const CAIXA = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc'
const VENDA = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd'

const pedido = (user: string, query: Record<string, unknown> = {}, params: Record<string, unknown> = {}) =>
    ({ user: { sub: user }, query, params }) as any

// Nada aqui pode gravar: qualquer create/update/delete/upsert falha o teste
const proibido = () => { throw new Error('as rotas do módulo Vendas só leem') }

function banco() {
    for (const k of Object.keys(db)) delete db[k]
    const tabela = (extra: Record<string, unknown> = {}) => ({
        create: proibido, update: proibido, updateMany: proibido, upsert: proibido, delete: proibido, deleteMany: proibido, ...extra,
    })
    db.user = tabela({
        findUnique: vi.fn(async ({ where }: any) => (where.id === ADMIN
            ? { role: 'ADMIN', userModules: [], name: 'Thomás' }
            : where.id === OPERADOR ? { role: 'CASHIER', userModules: [], name: 'Marcos' } : null)),
    })
    db.payment = tabela({ findMany: vi.fn(async () => [{ name: 'Pago na plataforma', kind: 'PLATAFORMA' }]) })
    db.paymentIdentifier = tabela({ findMany: vi.fn(async () => [{ name: 'iFood', is_correntista_debt: false, is_stock_evasion: false, platform: { code: 'IFOOD' } }]) })
    db.sale = tabela({
        findMany: vi.fn(async () => []),
        count: vi.fn(async () => 0),
        aggregate: vi.fn(async () => ({ _sum: { total_amount: 0 }, _count: { _all: 0 } })),
        findUnique: vi.fn(async () => null),
    })
    db.cashierEntry = tabela({ findMany: vi.fn(async () => []) })
    db.cancellationAudit = tabela({ findMany: vi.fn(async () => []) })
    db.saleItem = tabela({ findMany: vi.fn(async () => []) })
    db.stock = tabela({ findMany: vi.fn(async () => []) })
    db.cashierSession = tabela({ findMany: vi.fn(async () => []) })
}

describe('GET /api/vendas/conta (a conta única, D11)', () => {
    beforeEach(banco)

    it('do caixa: as vendas e os lançamentos do caixa, a linha da diferença', async () => {
        db.sale.findMany = vi.fn(async () => [
            { id: 'v1', status: 'COMPLETED', total_amount: 100 },
            { id: 'v2', status: 'COMPLETED', total_amount: 40 },
            { id: 'v3', status: 'CANCELLED', total_amount: 25 },
        ])
        db.cashierEntry.findMany = vi.fn(async () => [
            { sale_id: 'v1', payment_method: 'PIX', amount: 100, bank: 'STONE' },
            { sale_id: 'v2', payment_method: 'iFood', amount: 40 },
        ])
        const r = resposta()
        await getContaDasVendas(pedido(ADMIN, { caixa: CAIXA }), r)
        expect(r.code).toBe(200)
        expect(r.body.periodo).toBeNull() // só o caixa: o caixa inteiro, sem cortar por data
        expect(r.body.conta.vendido.total).toBe(140)
        expect(r.body.conta.recebido.total).toBe(100)
        expect(r.body.conta.diferenca.linha).toBe('Vendido R$ 140,00 − aplicativos a receber R$ 40,00 = Recebido R$ 100,00')
        expect(r.body.conta.cancelados).toEqual({ quantidade: 1, total: 25 })
        const ondeVendas = db.sale.findMany.mock.calls[0][0].where
        expect(ondeVendas).toEqual({ AND: [{ cashier_session_id: CAIXA }] })
        const ondeLancamentos = db.cashierEntry.findMany.mock.calls[0][0].where
        expect(ondeLancamentos.AND).toEqual(expect.arrayContaining([{ is_withdrawal: false }, { is_addition: false }, { cashier_session_id: CAIXA }]))
    })

    it('do período: dias operacionais; os lançamentos pela data da venda ou, sem venda, pela própria data', async () => {
        const r = resposta()
        await getContaDasVendas(pedido(ADMIN, { de: '2026-10-01', ate: '2026-10-31' }), r)
        expect(r.body.periodo).toEqual({ de: '2026-10-01', ate: '2026-10-31' })
        const faixa = { gte: new Date('2026-10-01T08:00:00.000Z'), lt: new Date('2026-11-01T08:00:00.000Z') }
        expect(db.sale.findMany.mock.calls[0][0].where).toEqual({ AND: [{ created_at: faixa }] })
        expect(db.cashierEntry.findMany.mock.calls[0][0].where.AND).toContainEqual({ OR: [{ sale: { created_at: faixa } }, { sale_id: null, created_at: faixa }] })
    })

    it('operador de caixa (CASHIER): só os caixas dele, como na lista de caixas', async () => {
        await getContaDasVendas(pedido(OPERADOR, { de: '2026-10-16' }), resposta())
        expect(db.sale.findMany.mock.calls[0][0].where.AND).toContainEqual({ cashierSession: { user_id: OPERADOR } })
        expect(db.cashierEntry.findMany.mock.calls[0][0].where.AND).toContainEqual({ session: { user_id: OPERADOR } })
    })

    it('data errada: 400 com o motivo', async () => {
        const r = resposta()
        await getContaDasVendas(pedido(ADMIN, { de: '16/10/2026' }), r)
        expect(r.code).toBe(400)
        expect(r.body.message).toContain('AAAA-MM-DD')
    })
})

describe('GET /api/vendas (lista venda a venda)', () => {
    beforeEach(banco)

    it('paginada, mais nova primeiro, com os totais sem as canceladas e o motivo da cancelada', async () => {
        db.sale.count = vi.fn(async () => 3)
        db.sale.aggregate = vi.fn(async () => ({ _sum: { total_amount: 150 }, _count: { _all: 2 } }))
        db.sale.findMany = vi.fn(async () => [
            { id: VENDA, created_at: new Date('2026-10-16T20:00:00Z'), status: 'CANCELLED', total_amount: 30, origin: 'Balcao', entries: [] },
            { id: 'v2', created_at: new Date('2026-10-16T19:00:00Z'), status: 'COMPLETED', total_amount: 50, origin: 'Delivery', entries: [{ amount: 50, payment_method: 'Dinheiro', platform_code: 'IFOOD' }] },
        ])
        db.cancellationAudit.findMany = vi.fn(async () => [{ id: 'c', sale_id: VENDA, product_name: 'Venda', quantity: 1, total_amount: 30, cancellation_type: 'VENDA_COMPLETA', reason: 'Desistiu', user_name: 'Ana', cancelled_at: '2026-10-16T20:05:00Z' }])
        const r = resposta()
        await getListaDeVendas(pedido(ADMIN, { de: '2026-10-16', pagina: '2', porPagina: '2' }), r)
        expect(r.code).toBe(200)
        expect(r.body).toMatchObject({ pagina: 2, porPagina: 2, total: 3, totais: { vendas: 2, canceladas: 1, valor: 150 } })
        const busca = db.sale.findMany.mock.calls[0][0]
        expect(busca).toMatchObject({ skip: 2, take: 2, orderBy: [{ created_at: 'desc' }, { id: 'desc' }] })
        expect(r.body.vendas[0]).toMatchObject({ cancelada: true, formas: [], cancelamento: { motivo: 'Desistiu', quem: 'Ana' } })
        // Delivery do iFood pago em dinheiro: origem iFood, forma Dinheiro
        expect(r.body.vendas[1]).toMatchObject({ origem: { tipo: 'IFOOD' }, formas: [{ forma: 'Dinheiro', valor: 50 }] })
        expect(db.cancellationAudit.findMany.mock.calls[0][0].where).toEqual({ sale_id: { in: [VENDA] } })
    })

    it('mais de 500 por página é recusado', async () => {
        await expect(getListaDeVendas(pedido(ADMIN, { porPagina: '5000' }), resposta())).rejects.toThrow()
    })
})

describe('GET /api/vendas/:id (detalhe, D3)', () => {
    beforeEach(banco)

    const venda = (dono: string) => ({
        id: VENDA, created_at: new Date('2026-10-16T19:00:00Z'), status: 'COMPLETED', total_amount: 30, origin: 'Balcao',
        items: [{ id: 'i1', product_id: 'p1', quantity: 1, unit_price: 30, discount: 0, unit_cost: 10, complements_cost: 0, product: { id: 'p1', name: 'Lanche', display_id: 1 } }],
        entries: [{ id: 'e1', amount: 30, payment_method: 'Dinheiro' }],
        cashierSession: { id: CAIXA, user_id: dono, period: 'Turno 01' },
    })

    it('o dono vê tudo, com o operador do caixa, a baixa do estoque e o custo (ADMIN)', async () => {
        db.sale.findUnique = vi.fn(async () => venda(ADMIN))
        db.stock.findMany = vi.fn(async () => [{ id: 's', sale_item_id: 'i1', product_id: 'p1', quantity: 1, operation: 'OUT', description: 'VENDA', created_at: new Date(), product: { id: 'p1', name: 'Lanche' } }])
        const r = resposta()
        await getDetalheDaVenda(pedido(ADMIN, {}, { id: VENDA }), r)
        expect(r.code).toBe(200)
        expect(r.body).toMatchObject({ operador: 'Thomás', veCusto: true, itens: [{ custo: 10, margem: 20 }], estoque: [{ nome: 'Lanche', itemId: 'i1' }] })
        expect(db.stock.findMany.mock.calls[0][0].where).toEqual({ sale_item_id: { in: ['i1'] } })
    })

    it('operador de caixa: sem custo e margem; venda de caixa de outro = 404', async () => {
        db.sale.findUnique = vi.fn(async () => venda(OPERADOR))
        const minha = resposta()
        await getDetalheDaVenda(pedido(OPERADOR, {}, { id: VENDA }), minha)
        expect(minha.body).toMatchObject({ veCusto: false, itens: [{ custo: null, margem: null }] })

        db.sale.findUnique = vi.fn(async () => venda(ADMIN))
        const deOutro = resposta()
        await getDetalheDaVenda(pedido(OPERADOR, {}, { id: VENDA }), deOutro)
        expect(deOutro.code).toBe(404)
    })
})

describe('relatórios do período', () => {
    beforeEach(banco)

    const itens = [
        { sale_id: 'v1', product_id: 'p1', quantity: 2, unit_price: 10, discount: 0, unit_cost: 3, seller_employee_id: 'f1', seller_name: 'Ana', product: { id: 'p1', name: 'Pão', display_id: 1 } },
        { sale_id: 'v2', product_id: 'p1', quantity: 1, unit_price: 10, discount: 0, unit_cost: 3, product: { id: 'p1', name: 'Pão', display_id: 1 } },
    ]

    it('produtos vendidos: só vendas concluídas, com o filtro do vendedor no item e a conta no rodapé', async () => {
        db.saleItem.findMany = vi.fn(async () => itens)
        const r = resposta()
        await getProdutosVendidos(pedido(ADMIN, { de: '2026-10-16', vendedor: 'f:f1', origem: 'BALCAO' }), r)
        expect(r.code).toBe(200)
        expect(r.body.produtos[0]).toMatchObject({ nome: 'Pão', quantidade: 3, faturamento: 30, custo: 9, margem: 21 })
        expect(r.body.conta).toBeTruthy()
        const onde = db.saleItem.findMany.mock.calls[0][0].where
        expect(JSON.stringify(onde)).toContain('"status":"CANCELLED"') // NOT CANCELLED
        expect(onde.AND).toContainEqual({ seller_employee_id: 'f1' })
    })

    it('vendedores', async () => {
        db.saleItem.findMany = vi.fn(async () => itens)
        const r = resposta()
        await getVendedoresDoPeriodo(pedido(ADMIN, { de: '2026-10-16' }), r)
        expect(r.body.vendedores.map((v: any) => [v.nome, v.faturamento])).toEqual([['Ana', 20], ['Sem vendedor', 10]])
    })

    it('cancelamentos: filtro por motivo, pessoa e tipo; as listas dos filtros são as do período inteiro', async () => {
        db.cancellationAudit.findMany = vi.fn(async () => [
            { id: 'a', sale_id: VENDA, product_name: 'X', quantity: 1, total_amount: 10, cancellation_type: 'ITEM_AVULSO', reason: 'Lançado errado', user_name: 'Ana', stock_restored: true, cancelled_at: '2026-10-16T20:00:00Z' },
            { id: 'b', sale_id: VENDA, product_name: 'Venda', quantity: 1, total_amount: 50, cancellation_type: 'VENDA_COMPLETA', reason: 'Desistiu', user_name: 'Marcos', stock_restored: false, cancelled_at: '2026-10-16T21:00:00Z' },
        ])
        db.sale.findMany = vi.fn(async () => [{ id: VENDA, display_id: 9, daily_number: 3, cashierSession: { user_id: ADMIN } }])
        const r = resposta()
        await getCancelamentosDasVendas(pedido(ADMIN, { de: '2026-10-16', pessoa: 'ana', motivo: 'lancado' }), r)
        expect(r.body.cancelamentos.map((c: any) => c.id)).toEqual(['a'])
        expect(r.body.totais).toMatchObject({ quantidade: 1, valor: 10, voltaramAoEstoque: 1 })
        expect(r.body.motivos).toEqual(['Desistiu', 'Lançado errado'])
        expect(r.body.pessoas).toEqual(['Ana', 'Marcos'])
        expect(r.body.cancelamentos[0].venda).toMatchObject({ numero: 9, senha: 3 })

        const soVendas = resposta()
        await getCancelamentosDasVendas(pedido(ADMIN, { de: '2026-10-16', tipo: 'vendas' }), soVendas)
        expect(soVendas.body.cancelamentos.map((c: any) => c.id)).toEqual(['b'])

        // O operador de caixa só vê os cancelamentos das vendas dos caixas dele
        const operador = resposta()
        await getCancelamentosDasVendas(pedido(OPERADOR, { de: '2026-10-16' }), operador)
        expect(operador.body.cancelamentos).toEqual([])
    })

    it('filtros: caixas, formas e vendedores do período', async () => {
        db.cashierSession.findMany = vi.fn(async () => [{ id: CAIXA, period: 'Turno 01', terminal_id: 'TERM-1', opened_at: new Date('2026-10-16T12:00:00Z'), status: 'OPEN' }])
        db.cashierEntry.findMany = vi.fn(async () => [{ payment_method: 'PIX' }, { payment_method: 'Dinheiro' }, { payment_method: ' ' }])
        db.saleItem.findMany = vi.fn(async () => [{ seller_employee_id: 'f1', seller_name: 'Ana', seller_number: 3, seller: { name: 'Ana Souza' } }, { seller_name: 'Bia' }])
        const r = resposta()
        await getFiltrosDasVendas(pedido(ADMIN, { de: '2026-10-16' }), r)
        expect(r.body.caixas).toEqual([expect.objectContaining({ id: CAIXA, nome: 'Turno 01', computador: 'TERM-1' })])
        expect(r.body.formas).toEqual(['Dinheiro', 'PIX'])
        expect(r.body.vendedores).toEqual([{ chave: 'f:f1', nome: 'Ana Souza', numero: 3 }, { chave: 'n:Bia', nome: 'Bia', numero: null }])
        expect(r.body.origens.map((o: any) => o.tipo)).toEqual(['BALCAO', 'MESA', 'COMANDA', 'DELIVERY', 'IFOOD', '99FOOD'])
    })
})
