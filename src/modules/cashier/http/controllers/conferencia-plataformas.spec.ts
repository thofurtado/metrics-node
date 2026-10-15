import { beforeEach, describe, expect, it, vi } from 'vitest'

// Conferência do caixa com as plataformas (iFood/99) e a despesa no Pix (15/10/2026, plano 2.2 e 2.4), com o banco simulado.
const db: any = vi.hoisted(() => ({}))
vi.mock('@/lib/prisma', () => ({ prisma: db }))

import { auditCashierSession, revertCashierAudit } from './cashier-controller'

function resposta() {
    const r: any = { code: 0, body: null }
    r.status = (c: number) => { r.code = c; return r }
    r.send = (b: any) => { r.body = b; return r }
    return r
}

const CAIXA = '11111111-1111-4111-8111-111111111111'
// Caixa aberto quinta 15/10/2026 às 10:00 de Brasília
const ABERTO_EM = new Date('2026-10-15T13:00:00.000Z')

let id = 0
function lancamento(parcial: Record<string, any>) {
    id++
    return {
        id: `e${id}`, cashier_session_id: CAIXA, origin: 'Delivery', bank: null, payment_method: 'Dinheiro', amount: 0,
        is_withdrawal: false, is_addition: false, is_tip: false, is_checked: false, type: 'SALE', identification: 'Delivery - Pedido #x',
        source: 'PDV', client_id: null, employee_id: null, sector_id: null, sale_id: null, platform_code: null, platform_own_delivery: null,
        client: null, created_at: ABERTO_EM, updated_at: ABERTO_EM,
        ...parcial,
    }
}

const PLATAFORMAS = [
    { id: 'p-ifood', code: 'IFOOD', name: 'iFood', account_id: null, commission_own_delivery_pct: 12, commission_platform_delivery_pct: 23, online_payment_fee_pct: 3.2, monthly_fee: 0, payout_weeks_after: 4, active: true },
    { id: 'p-99', code: '99FOOD', name: '99Food', account_id: 'conta-pagbank', commission_own_delivery_pct: 10.9, commission_platform_delivery_pct: 8.9, online_payment_fee_pct: 3.2, monthly_fee: 0, payout_weeks_after: 1, active: true },
]

const CONTAS = [
    { id: 'conta-transacao', name: 'Conta de Transação', is_transit: true },
    { id: 'conta-central', name: 'Caixa Central', is_transit: false },
    { id: 'conta-pagbank', name: 'PagBank', is_transit: false },
]

function montarBanco(entradas: any[], opcoes: { plataformas?: any[]; formas?: any[]; pedidos?: any[]; setores?: any[] } = {}) {
    for (const k of Object.keys(db)) delete db[k]
    const criadas: any[] = []
    const saldos: { id: string; delta: number }[] = []
    const setores = [...(opcoes.setores ?? [{ id: 's-fixas', name: 'Fixas' }])]
    const tx: any = {
        transaction: { deleteMany: vi.fn(), create: vi.fn(async ({ data }: any) => { criadas.push(data); return data }) },
        payrollEntry: { deleteMany: vi.fn(), create: vi.fn() },
        account: {
            findMany: vi.fn(async () => CONTAS),
            update: vi.fn(async ({ where, data }: any) => {
                saldos.push({ id: where.id, delta: data.balance.increment ?? -data.balance.decrement })
            }),
        },
        payment: { findMany: vi.fn(async () => opcoes.formas ?? [{ name: 'Pix', kind: null, account_id: null, active: true }, { name: 'Pago na plataforma', kind: 'PLATAFORMA', account_id: null, active: true }]) },
        paymentIdentifier: { findMany: vi.fn(async () => [{ name: 'iFood', platform: { code: 'IFOOD' } }, { name: '99Food', platform: { code: '99FOOD' } }]) },
        deliveryPlatform: { findMany: vi.fn(async () => opcoes.plataformas ?? PLATAFORMAS) },
        pedido: { findMany: vi.fn(async () => opcoes.pedidos ?? []) },
        sector: {
            findMany: vi.fn(async () => setores),
            create: vi.fn(async ({ data }: any) => { const s = { id: `s-${data.name}`, name: data.name }; setores.push(s); return s }),
        },
        pOSMachine: { findMany: vi.fn(async () => []) },
        cashierSession: { update: vi.fn(async () => ({ id: CAIXA, status: 'CHECKED' })) },
    }
    db.cashierSession = { findUnique: vi.fn(async () => ({ id: CAIXA, status: 'PENDING', period: 'Turno 01', user_id: 'u1', opened_at: ABERTO_EM, entries: entradas })) }
    db.user = { findUnique: vi.fn(async () => ({ name: 'Ana' })) }
    db.clientTab = { findMany: vi.fn(async () => []) }
    db.$transaction = vi.fn(async (fn: any) => fn(tx))
    return { criadas, saldos, tx, setores }
}

async function conferir() {
    const r = resposta()
    await auditCashierSession({ body: { session_id: CAIXA } } as any, r)
    return r
}

describe('conferência com venda de plataforma (plano 2.2)', () => {
    beforeEach(() => { id = 0 })

    it('pago no app vira o repasse da plataforma; a comissão de todas vira despesa no setor "Taxas de plataforma"', async () => {
        const { criadas, saldos, tx } = montarBanco([
            lancamento({ payment_method: 'iFood (pago no app)', amount: 100, sale_id: 'v1' }),
            lancamento({ payment_method: 'Dinheiro', amount: 40, sale_id: 'v2', platform_code: 'IFOOD', platform_own_delivery: false }),
            lancamento({ payment_method: 'Crédito', amount: 30, bank: 'Stone', sale_id: 'v3' }),
        ])
        const r = await conferir()
        expect(r.code).toBe(200)
        expect(r.body.avisos).toEqual([])

        const repasse = criadas.find(t => t.platform_id === 'p-ifood' && t.operation === 'income')
        expect(repasse).toMatchObject({
            amount: 100, totalValue: 100, confirmed: false, payment_method: 'PLATAFORMA',
            account_id: 'conta-transacao', // iFood sem conta: espera na Conta de Transação
            cashier_session_id: CAIXA,
        })
        expect(repasse.description).not.toContain('[DEST')
        expect(repasse.data_vencimento.toISOString()).toBe('2026-11-11T15:00:00.000Z')

        const comissao = criadas.find(t => t.platform_id === 'p-ifood' && t.operation === 'expense')
        // 100×12% + 100×3,2% (pago no app) + 40×23% (entregador do iFood, pago em dinheiro)
        expect(comissao).toMatchObject({ amount: 24.4, totalValue: 24.4, confirmed: false, sector_id: 's-Taxas de plataforma' })
        expect(tx.sector.create).toHaveBeenCalledWith(expect.objectContaining({ data: { name: 'Taxas de plataforma', type: 'out' } }))

        // A venda paga no app não cai na maquininha; a do cartão sim; o dinheiro da venda do iFood segue em Vendas em Dinheiro
        const receitas = criadas.filter(t => t.operation === 'income')
        expect(receitas.map(t => t.description).some((d: string) => d.includes('pago no app'))).toBe(false)
        expect(receitas.find(t => t.payment_method === 'crédito')).toMatchObject({ amount: 30 })
        expect(receitas.find(t => t.payment_method === 'DINHEIRO')).toMatchObject({ amount: 40 })
        expect(saldos).toEqual([{ id: 'conta-central', delta: 40 }])
    })

    it('plataforma com conta: o repasse passa pela Conta de Transação com [DEST: conta], como a maquininha', async () => {
        const { criadas } = montarBanco([lancamento({ payment_method: '99Food', amount: 50, platform_code: '99FOOD', platform_own_delivery: true })])
        await conferir()
        const repasse = criadas.find(t => t.platform_id === 'p-99' && t.operation === 'income')
        expect(repasse.account_id).toBe('conta-transacao')
        expect(repasse.description).toContain('[DEST: conta-pagbank]')
        expect(repasse.data_vencimento.toISOString()).toBe('2026-10-21T15:00:00.000Z')
        const comissao = criadas.find(t => t.platform_id === 'p-99' && t.operation === 'expense')
        expect(comissao.amount).toBe(7.05) // 50 × (10,9% + 3,2%)
    })

    it('venda antiga em dinheiro: a plataforma vem do pedido e só a comissão nasce', async () => {
        const { criadas } = montarBanco(
            [lancamento({ payment_method: 'Dinheiro', amount: 57.83, sale_id: 'v9' })],
            { pedidos: [{ uuid: 'v9', plataforma: '99FOOD' }] },
        )
        await conferir()
        expect(criadas.filter(t => t.platform_id === 'p-99').map(t => [t.operation, t.amount])).toEqual([['expense', 6.3]])
    })

    it('plataforma sem cadastro: como antes (a receber vencendo no dia) e o aviso volta na resposta', async () => {
        const { criadas } = montarBanco([lancamento({ payment_method: '99Food (pago no app)', amount: 26.34, sale_id: 'v5' })], { plataformas: [] })
        const r = await conferir()
        expect(r.body.avisos[0]).toContain('Cadastre a plataforma 99Food')
        expect(criadas.some(t => t.platform_id)).toBe(false)
        const antes = criadas.find(t => t.payment_method === '99food (pago no app)')
        expect(antes).toMatchObject({ amount: 26.34, confirmed: false, interest: 0 })
        expect(antes.data_vencimento.toISOString()).toBe(ABERTO_EM.toISOString())
    })
})

describe('despesa do caixa no Pix e o setor Motoboy (plano 2.4)', () => {
    beforeEach(() => { id = 0 })

    it('Pix sem conta na forma: despesa pendente, sem conta, fora do dinheiro do Caixa Central', async () => {
        const { criadas, saldos } = montarBanco([
            lancamento({ type: 'EXPENSE', is_withdrawal: true, payment_method: 'Pix', amount: 80, identification: 'SaidaOperacional: [Motoboy] Acerto de Valentina: 8 entregas', sector_id: 's-moto' }),
            lancamento({ payment_method: 'Dinheiro', amount: 100 }),
        ], { setores: [{ id: 's-moto', name: 'Motoboy' }] })
        const r = await conferir()
        expect(r.code).toBe(200) // "Valentina" tem "vale" no texto, mas é despesa do PDV: não para a conferência
        const despesa = criadas.find(t => t.operation === 'expense')
        expect(despesa).toMatchObject({ amount: 80, confirmed: false, account_id: null, payment_method: 'PIX', sector_id: 's-moto' })
        expect(saldos).toEqual([{ id: 'conta-central', delta: 100 }]) // o Pix não saiu do Caixa Central
    })

    it('Pix com conta na forma: despesa paga nessa conta, que tem o saldo baixado', async () => {
        const { criadas, saldos } = montarBanco(
            [lancamento({ type: 'EXPENSE', is_withdrawal: true, payment_method: 'Pix', amount: 80, identification: 'SaidaOperacional: [Motoboy] Acerto' })],
            { formas: [{ name: 'Pix', kind: null, account_id: 'conta-pagbank', active: true }] },
        )
        await conferir()
        expect(criadas.find(t => t.operation === 'expense')).toMatchObject({ confirmed: true, account_id: 'conta-pagbank' })
        expect(saldos).toEqual([{ id: 'conta-pagbank', delta: -80 }])
    })

    it('acerto antigo em dinheiro "[Motoboy]" sem setor: setor Motoboy (criado se faltar) e sai do Caixa Central', async () => {
        const { criadas, saldos, tx } = montarBanco([
            lancamento({ type: 'EXPENSE', is_withdrawal: true, payment_method: 'Dinheiro', amount: 108.96, identification: 'SaidaOperacional: [Motoboy] Acerto de Henrique: 12 entregas + 1 diária' }),
        ])
        await conferir()
        expect(tx.sector.create).toHaveBeenCalledWith(expect.objectContaining({ data: { name: 'Motoboy', type: 'out' } }))
        expect(criadas.find(t => t.operation === 'expense')).toMatchObject({ confirmed: true, account_id: 'conta-central', sector_id: 's-Motoboy', payment_method: 'DINHEIRO' })
        expect(saldos).toEqual([{ id: 'conta-central', delta: -108.96 }])
    })
})

describe('reverter conferência com repasse já liquidado', () => {
    it('recusa e diz para desfazer a liquidação do repasse antes', async () => {
        for (const k of Object.keys(db)) delete db[k]
        db.cashierSession = { findUnique: vi.fn(async () => ({ id: CAIXA, status: 'CHECKED' })) }
        db.transaction = { findFirst: vi.fn(async () => ({ description: 'Caixa Turno 01 Ana 15/10/2026 - iFood (repasse de 11/11/2026) (Liquidado)' })) }
        db.$transaction = vi.fn()
        const r = resposta()
        await revertCashierAudit({ body: { session_id: CAIXA } } as any, r)
        expect(r.code).toBe(409)
        expect(r.body.code).toBe('REPASSE_LIQUIDADO')
        expect(db.$transaction).not.toHaveBeenCalled()
    })
})
