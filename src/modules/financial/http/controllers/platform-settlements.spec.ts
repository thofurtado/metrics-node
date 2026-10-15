import { beforeEach, describe, expect, it, vi } from 'vitest'

// Liquidação do repasse das plataformas (15/10/2026, plano 2.3), com o banco simulado.
const db: any = vi.hoisted(() => ({}))
vi.mock('@/lib/prisma', () => ({ prisma: db }))

import { listPlatformSettlements, revertPlatformSettlement, settlePlatformPayout } from './platform-settlements'
import { revertSettlement } from './settlements'
import { agruparRepasses, ajusteDoRepasse, contaDoRepasse, descricaoDesfeita, descricaoLiquidada } from '../../services/repasse-da-plataforma'

function resposta() {
    const r: any = { code: 0, body: null }
    r.status = (c: number) => { r.code = c; return r }
    r.send = (b: any) => { r.body = b; return r }
    return r
}

const IFOOD = { id: '77777777-7777-4777-8777-777777777777', code: 'IFOOD', name: 'iFood', account_id: null }
const REPASSE = new Date('2026-11-11T15:00:00.000Z')

function transacao(parcial: Record<string, any>): any {
    return {
        id: 't', operation: 'income', amount: 0, totalValue: null, confirmed: false, account_id: 'conta-transacao', description: 'x',
        data_vencimento: REPASSE, platform_id: IFOOD.id, platform_settlement_id: null, cashier_session_id: 'caixa-1',
        ...parcial,
    }
}

const PENDENTES = [
    transacao({ id: 'r1', amount: 100, totalValue: 100, description: 'Caixa Turno 01 Ana 13/10/2026 - iFood (repasse de 11/11/2026)', cashier_session_id: 'caixa-13' }),
    transacao({ id: 'r2', amount: 50, totalValue: 50, description: 'Caixa Turno 01 Ana 14/10/2026 - iFood (repasse de 11/11/2026)', cashier_session_id: 'caixa-14' }),
    transacao({ id: 'c1', operation: 'expense', amount: 15.2, totalValue: 15.2, description: 'Comissão iFood - Caixa 13/10', cashier_session_id: 'caixa-13' }),
    transacao({ id: 'c2', operation: 'expense', amount: 7.6, totalValue: 7.6, description: 'Comissão iFood - Caixa 14/10', cashier_session_id: 'caixa-14' }),
]

describe('regras do repasse', () => {
    it('agrupa por plataforma e data: previsto = repasses − comissões', () => {
        const [g] = agruparRepasses(PENDENTES as any, [IFOOD])
        expect(g).toMatchObject({ situacao: 'PENDENTE', payout_date: '2026-11-11', total_receitas: 150, total_comissoes: 22.8, previsto: 127.2, recebido: null })
        expect(g.caixas).toEqual(['caixa-13', 'caixa-14'])
    })

    it('liquidado: agrupa pela liquidação e o recebido soma o ajuste', () => {
        const liquidadas = PENDENTES.map(t => ({ ...t, confirmed: true, platform_settlement_id: 'L1' }))
        liquidadas.push(transacao({ id: 'a1', operation: 'expense', amount: 2.2, totalValue: 2.2, confirmed: true, platform_settlement_id: 'L1', cashier_session_id: null }))
        const [g] = agruparRepasses(liquidadas as any, [IFOOD])
        expect(g).toMatchObject({ situacao: 'LIQUIDADO', settlement_id: 'L1', previsto: 127.2, recebido: 125 })
        expect(g.ajustes.map(a => a.id)).toEqual(['a1'])
    })

    it('a conta: a escolhida, senão a da plataforma, senão a marca [DEST], senão a das transações (nunca a de transação)', () => {
        const transit = new Set(['conta-transacao'])
        expect(contaDoRepasse('escolhida', 'plataforma', [], transit)).toBe('escolhida')
        expect(contaDoRepasse(null, 'plataforma', [{ description: 'x [DEST: marcada]', account_id: 'conta-transacao' }], transit)).toBe('plataforma')
        expect(contaDoRepasse(null, null, [{ description: 'x [DEST: marcada]', account_id: 'conta-transacao' }], transit)).toBe('marcada')
        expect(contaDoRepasse(null, null, [{ description: 'x', account_id: 'conta-transacao' }], transit)).toBeNull()
        expect(contaDoRepasse(null, null, [{ description: 'x', account_id: 'pagbank' }], transit)).toBe('pagbank')
    })

    it('ajuste: caiu menos = despesa, caiu mais = receita, igual = nada', () => {
        expect(ajusteDoRepasse(127.2, 125)).toEqual({ operation: 'expense', amount: 2.2 })
        expect(ajusteDoRepasse(127.2, 130)).toEqual({ operation: 'income', amount: 2.8 })
        expect(ajusteDoRepasse(127.2, 127.2)).toBeNull()
    })

    it('descrição: tira a marca e põe "(Liquidado)"; desfazer tira o "(Liquidado)"', () => {
        expect(descricaoLiquidada('Caixa X - iFood (repasse de 11/11/2026) [DEST: abc]')).toBe('Caixa X - iFood (repasse de 11/11/2026) (Liquidado)')
        expect(descricaoDesfeita('Caixa X - iFood (repasse de 11/11/2026) (Liquidado)')).toBe('Caixa X - iFood (repasse de 11/11/2026)')
    })
})

describe('baixa do repasse', () => {
    let tx: any
    let atualizadas: any[]
    let criadas: any[]
    let saldos: any[]
    beforeEach(() => {
        for (const k of Object.keys(db)) delete db[k]
        atualizadas = []
        criadas = []
        saldos = []
        tx = {
            transaction: {
                update: vi.fn(async ({ where, data }: any) => { atualizadas.push({ id: where.id, ...data }) }),
                create: vi.fn(async ({ data }: any) => { criadas.push(data); return { operation: data.operation, amount: data.amount, totalValue: data.totalValue, account_id: data.account_id } }),
                deleteMany: vi.fn(),
            },
            account: { update: vi.fn(async ({ where, data }: any) => { saldos.push({ id: where.id, ...data.balance }) }) },
            sector: { findMany: vi.fn(async () => [{ id: 's-taxas', name: 'Taxas de plataforma' }]), create: vi.fn() },
        }
        db.deliveryPlatform = { findUnique: vi.fn(async () => IFOOD), findMany: vi.fn(async () => [IFOOD]) }
        db.transaction = { findMany: vi.fn(async () => PENDENTES.map(t => ({ ...t }))) }
        db.account = { findMany: vi.fn(async () => [{ id: 'conta-transacao', is_transit: true }, { id: '88888888-8888-4888-8888-888888888888', is_transit: false }]) }
        db.$transaction = vi.fn(async (fn: any) => fn(tx))
    })

    const CONTA = '88888888-8888-4888-8888-888888888888'

    it('sem conta na plataforma e sem escolha: pede a conta', async () => {
        const r = resposta()
        await settlePlatformPayout({ body: { platform_id: IFOOD.id, payout_date: '2026-11-11' } } as any, r)
        expect(r.code).toBe(400)
        expect(r.body.code).toBe('ESCOLHA_A_CONTA')
    })

    it('caiu diferente sem motivo: recusa', async () => {
        const r = resposta()
        await settlePlatformPayout({ body: { platform_id: IFOOD.id, payout_date: '2026-11-11', account_id: CONTA, received_amount: 125 } } as any, r)
        expect(r.code).toBe(400)
        expect(r.body.code).toBe('MOTIVO_DA_DIFERENCA')
        expect(db.$transaction).not.toHaveBeenCalled()
    })

    it('baixa repasses e comissões juntos na conta, cria o ajuste e a conta recebe o que caiu', async () => {
        const r = resposta()
        await settlePlatformPayout({ body: { platform_id: IFOOD.id, payout_date: '2026-11-11', account_id: CONTA, received_amount: 125, reason: 'promoção' } } as any, r)
        expect(r.code).toBe(200)
        expect(r.body).toMatchObject({ previsto: 127.2, recebido: 125, diferenca: -2.2, account_id: CONTA })

        // busca só as pendentes da plataforma naquele dia de Brasília
        const filtro = db.transaction.findMany.mock.calls[0][0].where
        expect(filtro).toMatchObject({ platform_id: IFOOD.id, confirmed: false, platform_settlement_id: null })
        expect(filtro.data_vencimento.gte.toISOString()).toBe('2026-11-11T03:00:00.000Z')
        expect(filtro.data_vencimento.lt.toISOString()).toBe('2026-11-12T03:00:00.000Z')

        expect(atualizadas.map(a => a.id).sort()).toEqual(['c1', 'c2', 'r1', 'r2'])
        expect(atualizadas.every(a => a.confirmed && a.account_id === CONTA && a.platform_settlement_id === r.body.settlement_id)).toBe(true)
        expect(criadas).toHaveLength(1)
        expect(criadas[0]).toMatchObject({ operation: 'expense', amount: 2.2, confirmed: true, account_id: CONTA, sector_id: 's-taxas', platform_settlement_id: r.body.settlement_id })
        expect(criadas[0].description).toContain('promoção')
        expect(saldos).toEqual([{ id: CONTA, increment: 125 }])
    })

    it('sem valor digitado: entra o previsto, sem ajuste', async () => {
        const r = resposta()
        await settlePlatformPayout({ body: { platform_id: IFOOD.id, payout_date: '2026-11-11', account_id: CONTA } } as any, r)
        expect(r.body).toMatchObject({ recebido: 127.2, diferenca: 0 })
        expect(criadas).toHaveLength(0)
        expect(saldos).toEqual([{ id: CONTA, increment: 127.2 }])
    })

    it('nada pendente na data: 404', async () => {
        db.transaction.findMany = vi.fn(async () => [])
        const r = resposta()
        await settlePlatformPayout({ body: { platform_id: IFOOD.id, payout_date: '2026-11-18', account_id: CONTA } } as any, r)
        expect(r.code).toBe(404)
    })
})

describe('desfazer a liquidação do repasse', () => {
    let tx: any
    beforeEach(() => {
        for (const k of Object.keys(db)) delete db[k]
        const liquidadas = PENDENTES.map(t => ({ ...t, confirmed: true, account_id: 'pagbank', platform_settlement_id: '99999999-9999-4999-8999-999999999999', description: `${t.description} (Liquidado)` }))
        liquidadas.push(transacao({ id: 'a1', operation: 'expense', amount: 2.2, totalValue: 2.2, confirmed: true, account_id: 'pagbank', platform_settlement_id: '99999999-9999-4999-8999-999999999999', cashier_session_id: null }))
        tx = { transaction: { update: vi.fn(), deleteMany: vi.fn() }, account: { update: vi.fn() } }
        db.transaction = { findMany: vi.fn(async () => liquidadas), findUnique: vi.fn(async () => ({ ...liquidadas[0], operation: 'income' })) }
        db.$transaction = vi.fn(async (fn: any) => fn(tx))
    })

    it('tira o que caiu da conta, apaga o ajuste e volta repasses e comissões a pendentes', async () => {
        const r = resposta()
        await revertPlatformSettlement({ params: { id: '99999999-9999-4999-8999-999999999999' } } as any, r)
        expect(r.code).toBe(200)
        expect(tx.account.update).toHaveBeenCalledWith({ where: { id: 'pagbank' }, data: { balance: { decrement: 125 } } })
        expect(tx.transaction.deleteMany).toHaveBeenCalledWith({ where: { id: { in: ['a1'] } } })
        expect(tx.transaction.update).toHaveBeenCalledTimes(4)
        expect(tx.transaction.update.mock.calls[0][0].data).toEqual({ confirmed: false, platform_settlement_id: null, description: PENDENTES[0].description })
    })

    it('o "reverter" da lista de liquidações desfaz a do repasse inteira', async () => {
        const r = resposta()
        await revertSettlement({ params: { id: '00000000-0000-4000-8000-000000000001' } } as any, r)
        expect(r.code).toBe(200)
        expect(tx.transaction.update).toHaveBeenCalledTimes(4)
        expect(tx.account.update).toHaveBeenCalledTimes(1)
    })
})

describe('lista dos repasses', () => {
    it('pendentes por padrão, agrupados', async () => {
        for (const k of Object.keys(db)) delete db[k]
        db.transaction = { findMany: vi.fn(async () => PENDENTES) }
        db.deliveryPlatform = { findMany: vi.fn(async () => [IFOOD]) }
        const r = resposta()
        await listPlatformSettlements({ query: {} } as any, r)
        expect(db.transaction.findMany.mock.calls[0][0].where).toMatchObject({ confirmed: false })
        expect(r.body.data).toHaveLength(1)
        expect(r.body.data[0].previsto).toBe(127.2)
    })
})
