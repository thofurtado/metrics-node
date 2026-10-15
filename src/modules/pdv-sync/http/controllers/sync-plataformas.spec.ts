import { beforeEach, describe, expect, it, vi } from 'vitest'

// Sincronia do PDV para as plataformas e o motoboy (15/10/2026): plataforma da venda, setor e forma da despesa, formas e
// identificadores com o tipo/plataforma. Banco simulado.
const db: any = vi.hoisted(() => ({}))
vi.mock('@/lib/prisma', () => ({ prisma: db }))

import { postSalesSync } from './sales-sync-controller'
import { postCashierMovementsSync } from './cashier-sync-controller'
import { getPaymentIdentifiersSync, getPaymentsSync } from './pdv-sync-controller'
import { plataformaDaVenda, plataformaMudou } from '../../services/cashier-sync-rules'

function resposta() {
    const r: any = { code: 0, body: null }
    r.status = (c: number) => { r.code = c; return r }
    r.send = (b: any) => { r.body = b; return r }
    return r
}

function zerar() {
    for (const k of Object.keys(db)) delete db[k]
}

const CAIXA = '33333333-3333-4333-8333-333333333333'
const VENDA = '44444444-4444-4444-8444-444444444441'
const IDENT_IFOOD = '55555555-5555-4555-8555-555555555555'

describe('plataforma da venda (regra)', () => {
    it('o que o PDV manda vale; sem isso, a plataforma do identificador; PDV antigo = não mexe', () => {
        expect(plataformaDaVenda({ PlataformaCodigo: 'iFood', EntregaPropria: false }, [])).toEqual({ platform_code: 'IFOOD', platform_own_delivery: false })
        expect(plataformaDaVenda({}, ['99FOOD'])).toEqual({ platform_code: '99FOOD', platform_own_delivery: null })
        expect(plataformaDaVenda({ PlataformaCodigo: null }, [])).toEqual({ platform_code: null, platform_own_delivery: null })
        expect(plataformaDaVenda({}, [null])).toBeUndefined()
    })

    it('mudou só quando a venda diz outra coisa', () => {
        const guardado = [{ platform_code: 'IFOOD', platform_own_delivery: true }]
        expect(plataformaMudou(guardado, undefined)).toBe(false)
        expect(plataformaMudou(guardado, { platform_code: 'IFOOD', platform_own_delivery: true })).toBe(false)
        expect(plataformaMudou(guardado, { platform_code: 'IFOOD', platform_own_delivery: false })).toBe(true)
    })
})

describe('venda do PDV com PlataformaCodigo e EntregaPropria', () => {
    let tx: any
    beforeEach(() => {
        zerar()
        tx = {
            sale: { findUnique: vi.fn(async () => null), upsert: vi.fn(async () => ({})), update: vi.fn() },
            cashierSession: { findUnique: vi.fn(async () => ({ status: 'OPEN' })) },
            cashierEntry: { findMany: vi.fn(async () => []), deleteMany: vi.fn(), create: vi.fn(), updateMany: vi.fn() },
            saleItem: { findMany: vi.fn(async () => []), findUnique: vi.fn() },
            clientTab: { findMany: vi.fn(async () => []), deleteMany: vi.fn(), update: vi.fn(), create: vi.fn() },
        }
        db.paymentIdentifier = { findMany: vi.fn(async () => [{ id: IDENT_IFOOD, name: 'iFood', platform: { code: 'IFOOD' } }]) }
        db.pOSMachine = { findMany: vi.fn(async () => []) }
        db.$transaction = vi.fn(async (fn: any) => fn(tx))
    })

    const venda = (extra: Record<string, any>, pagamentos: any[]) => ({
        Uuid: VENDA, CashierSessionId: CAIXA, Origin: 'iFood', TotalAmount: 50, Items: [], Payments: pagamentos, ...extra,
    })

    it('pedido do iFood pago em dinheiro: os lançamentos levam a plataforma e quem entregou', async () => {
        const r = resposta()
        await postSalesSync({ body: [venda({ PlataformaCodigo: 'IFOOD', EntregaPropria: true }, [{ Method: 'Dinheiro', Amount: 50, Categoria: 'Dinheiro' }])] } as any, r)
        expect(r.code).toBe(201)
        expect(tx.cashierEntry.create.mock.calls[0][0].data).toMatchObject({ payment_method: 'Dinheiro', platform_code: 'IFOOD', platform_own_delivery: true })
    })

    it('pago no app pelo identificador "iFood" da forma Plataforma: a plataforma vem do identificador', async () => {
        await postSalesSync({ body: [venda({}, [{ Method: 'Pago na plataforma', Amount: 50, IdentificadorUuid: IDENT_IFOOD }])] } as any, resposta())
        expect(tx.cashierEntry.create.mock.calls[0][0].data).toMatchObject({ payment_method: 'iFood', platform_code: 'IFOOD', platform_own_delivery: null })
    })

    it('PDV antigo (sem os campos): nada de plataforma', async () => {
        await postSalesSync({ body: [venda({}, [{ Method: 'Dinheiro', Amount: 50 }])] } as any, resposta())
        expect(tx.cashierEntry.create.mock.calls[0][0].data).toMatchObject({ platform_code: null, platform_own_delivery: null })
    })

    it('reenvio igual com a plataforma nova completa os lançamentos guardados (caixa não conferido)', async () => {
        tx.sale.findUnique = vi.fn(async () => ({ cashier_session_id: CAIXA, total_amount: 50, discount: 0, status: 'COMPLETED', origin: 'iFood' }))
        tx.cashierEntry.findMany = vi.fn(async () => [{ id: 'e1', identification: `iFood - Pedido #${VENDA.slice(0, 8)}`, payment_method: 'Dinheiro', amount: 50, platform_code: null, platform_own_delivery: null }])
        const r = resposta()
        await postSalesSync({ body: [venda({ PlataformaCodigo: 'IFOOD', EntregaPropria: false }, [{ Method: 'Dinheiro', Amount: 50 }])] } as any, r)
        expect(r.code).toBe(201)
        expect(tx.cashierEntry.create).not.toHaveBeenCalled()
        expect(tx.cashierEntry.updateMany).toHaveBeenCalledWith({ where: { id: { in: ['e1'] } }, data: { platform_code: 'IFOOD', platform_own_delivery: false } })
    })

    it('motoboy trocado no PDV (entrega da loja -> entregador do iFood): o reenvio só muda quem entregou, sem lançamento novo', async () => {
        tx.sale.findUnique = vi.fn(async () => ({ cashier_session_id: CAIXA, total_amount: 50, discount: 0, status: 'COMPLETED', origin: 'iFood' }))
        tx.cashierEntry.findMany = vi.fn(async () => [{ id: 'e1', identification: `iFood - Pedido #${VENDA.slice(0, 8)}`, payment_method: 'iFood', amount: 50, platform_code: 'IFOOD', platform_own_delivery: true }])
        const r = resposta()
        await postSalesSync({ body: [venda({ PlataformaCodigo: 'IFOOD', EntregaPropria: false }, [{ Method: 'Pago na plataforma', Amount: 50, IdentificadorUuid: IDENT_IFOOD }])] } as any, r)
        expect(r.code).toBe(201)
        expect(tx.cashierEntry.create).not.toHaveBeenCalled()
        expect(tx.cashierEntry.deleteMany).not.toHaveBeenCalled()
        expect(tx.cashierEntry.updateMany).toHaveBeenCalledWith({ where: { id: { in: ['e1'] } }, data: { platform_code: 'IFOOD', platform_own_delivery: false } })
    })

    it('reenvio igual para caixa conferido: aceita e não mexe', async () => {
        tx.sale.findUnique = vi.fn(async () => ({ cashier_session_id: CAIXA, total_amount: 50, discount: 0, status: 'COMPLETED', origin: 'iFood' }))
        tx.cashierSession.findUnique = vi.fn(async () => ({ status: 'CHECKED' }))
        tx.cashierEntry.findMany = vi.fn(async () => [{ id: 'e1', identification: `iFood - Pedido #${VENDA.slice(0, 8)}`, payment_method: 'Dinheiro', amount: 50, platform_code: null, platform_own_delivery: null }])
        const r = resposta()
        await postSalesSync({ body: [venda({ PlataformaCodigo: 'IFOOD' }, [{ Method: 'Dinheiro', Amount: 50 }])] } as any, r)
        expect(r.code).toBe(201)
        expect(tx.cashierEntry.updateMany).not.toHaveBeenCalled()
    })
})

describe('despesa do PDV com Categoria e forma Pix (plano 2.4)', () => {
    let tx: any
    let setores: any[]
    beforeEach(() => {
        zerar()
        setores = [{ id: 's-fixas', name: 'Fixas' }]
        tx = {
            cashierSession: { findUnique: vi.fn(async () => ({ id: CAIXA, status: 'OPEN' })) },
            cashierEntry: { upsert: vi.fn(), findUnique: vi.fn() },
            employee: { findFirst: vi.fn(async () => null) },
            sector: {
                findMany: vi.fn(async () => setores),
                create: vi.fn(async ({ data }: any) => { const s = { id: `s-${data.name}`, name: data.name }; setores.push(s); return s }),
            },
        }
        db.$transaction = vi.fn(async (fn: any) => fn(tx))
    })

    const movimento = (extra: Record<string, any>) => ({
        uuid: '66666666-6666-4666-8666-666666666666', cashier_session_id: CAIXA, tipo: 'SaidaOperacional', valor: 80,
        observacao: '[Motoboy] Acerto de Valentina: 8 entregas', ...extra,
    })

    it('Categoria "Motoboy" e Pix: setor Motoboy (criado uma vez) e a forma Pix', async () => {
        const r = resposta()
        await postCashierMovementsSync({ body: [movimento({ categoria: 'motoboy', payment_method: 'Pix' }), movimento({ uuid: '66666666-6666-4666-8666-666666666667', Categoria: 'Motoboy' })] } as any, r)
        expect(r.body.accepted).toHaveLength(2)
        expect(tx.sector.create).toHaveBeenCalledTimes(1)
        const [primeiro, segundo] = tx.cashierEntry.upsert.mock.calls.map((c: any) => c[0])
        expect(primeiro.create).toMatchObject({ payment_method: 'Pix', sector_id: 's-Motoboy', type: 'EXPENSE', is_withdrawal: true })
        expect(segundo.create).toMatchObject({ payment_method: 'Dinheiro', sector_id: 's-Motoboy' })
    })

    it('PDV antigo: o texto "[Motoboy]" sem categoria vai para o setor Motoboy; sem forma = Dinheiro', async () => {
        setores.push({ id: 's-moto', name: 'Motoboy' })
        await postCashierMovementsSync({ body: [movimento({})] } as any, resposta())
        expect(tx.cashierEntry.upsert.mock.calls[0][0].create).toMatchObject({ payment_method: 'Dinheiro', sector_id: 's-moto' })
        expect(tx.sector.create).not.toHaveBeenCalled()
    })

    it('despesa sem categoria e sem o texto do motoboy: não mexe no setor', async () => {
        await postCashierMovementsSync({ body: [movimento({ observacao: 'gás' })] } as any, resposta())
        const chamada = tx.cashierEntry.upsert.mock.calls[0][0]
        expect(chamada.create.sector_id).toBeNull()
        expect(chamada.update).not.toHaveProperty('sector_id')
    })

    it('sangria com Categoria não ganha setor (viraria despesa na conferência)', async () => {
        await postCashierMovementsSync({ body: [movimento({ tipo: 'Sangria', categoria: 'Motoboy' })] } as any, resposta())
        expect(tx.cashierEntry.upsert.mock.calls[0][0].create.sector_id).toBeNull()
    })
})

describe('formas e identificadores que o PDV baixa', () => {
    beforeEach(zerar)

    it('a forma leva Kind (PLATAFORMA ou null)', async () => {
        db.payment = { findMany: vi.fn(async () => [
            { id: 'f1', name: 'Pago na plataforma', installment_limit: 1, in_sight: false, account_id: null, active: true, sefaz_tPag: null, kind: 'PLATAFORMA', created_at: new Date() },
            { id: 'f2', name: 'Pix', installment_limit: 1, in_sight: true, account_id: null, active: true, sefaz_tPag: '17', kind: null, created_at: new Date() },
        ]) }
        const r = resposta()
        await getPaymentsSync({} as any, r)
        expect(r.body.map((f: any) => [f.Name, f.Kind])).toEqual([['Pago na plataforma', 'PLATAFORMA'], ['Pix', null]])
    })

    it('o identificador leva PlatformCode (IFOOD, 99FOOD ou null)', async () => {
        db.paymentIdentifier = { findMany: vi.fn(async () => [
            { id: 'i1', name: 'iFood', is_correntista_debt: false, is_stock_evasion: false, payment_method_id: 'f1', active: true, created_at: new Date(), platform: { code: 'IFOOD' } },
            { id: 'i2', name: 'Permuta', is_correntista_debt: true, is_stock_evasion: false, payment_method_id: null, active: true, created_at: new Date(), platform: null },
        ]) }
        const r = resposta()
        await getPaymentIdentifiersSync({} as any, r)
        expect(r.body.map((i: any) => [i.Name, i.PlatformCode])).toEqual([['iFood', 'IFOOD'], ['Permuta', null]])
    })
})
