import { beforeEach, describe, expect, it, vi } from 'vitest'

// Motoboys do PDV na nuvem (15/10/2026, plano 2.5): normalização, rotas em lote e o relatório da web. Banco simulado.
const db: any = vi.hoisted(() => ({}))
vi.mock('@/lib/prisma', () => ({ prisma: db }))

import {
    diaDaEntrega,
    formaDoPagamento,
    normalizarEntregaAPagar,
    normalizarMotoboy,
    relatorioDosMotoboys,
    situacaoDaEntrega,
    tipoDaEntrega,
} from './motoboys-do-pdv'
import { postCourierPayablesSync, postCouriersSync } from '../http/controllers/couriers-sync-controller'
import { getCouriersReport } from '@/modules/cashier/http/controllers/couriers-report-controller'

function resposta() {
    const r: any = { code: 0, body: null }
    r.status = (c: number) => { r.code = c; return r }
    r.send = (b: any) => { r.body = b; return r }
    return r
}

const HENRIQUE = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1'
const NOVO = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa2'

describe('normalização do que o PDV manda', () => {
    it('situação, tipo e forma em qualquer grafia', () => {
        expect(situacaoDaEntrega('PAGA')).toBe('PAGA')
        expect(situacaoDaEntrega('Não paga')).toBe('NAO_PAGA')
        expect(situacaoDaEntrega('NAO_PAGA')).toBe('NAO_PAGA')
        expect(situacaoDaEntrega('qualquer')).toBe('PENDENTE')
        expect(tipoDaEntrega('DIARIA')).toBe('DIARIA')
        expect(tipoDaEntrega('Diária')).toBe('DIARIA')
        expect(tipoDaEntrega(null)).toBe('ENTREGA')
        expect(formaDoPagamento('pix')).toBe('Pix')
        expect(formaDoPagamento('Dinheiro')).toBe('Dinheiro')
        expect(formaDoPagamento(null)).toBeNull()
    })

    it('dia: o do PDV; sem ele, o dia de Brasília da entrega', () => {
        expect(diaDaEntrega('2026-10-15', new Date())).toBe('2026-10-15')
        expect(diaDaEntrega(null, new Date('2026-10-16T01:30:00.000Z'))).toBe('2026-10-15') // 22:30 de Brasília
    })

    it('motoboy e entrega viram as colunas da nuvem, em centavos', () => {
        expect(normalizarMotoboy({ Uuid: HENRIQUE, Nome: ' Henrique ', FormaGanho: 'PERCENTUAL', ValorPorEntrega: 7.005, Diaria: 30, GanhoDesde: '2026-10-01T00:00:00Z' }))
            .toMatchObject({ id: HENRIQUE, name: 'Henrique', earning_mode: 'PERCENTUAL', value_per_delivery: 7.01, daily_rate: 30, active: true })
        expect(normalizarEntregaAPagar({ Uuid: 'e1', MotoboyUuid: NOVO, Tipo: 'ENTREGA', Dia: '2026-10-15', ValorAPagar: 7, Situacao: 'PAGA', FormaPagamento: 'Pix', PagoEm: '2026-10-15T20:00:00Z' }, false))
            .toMatchObject({ id: 'e1', courier_uuid: NOVO, courier_id: null, kind: 'ENTREGA', day: '2026-10-15', amount_due: 7, status: 'PAGA', payment_method: 'Pix' })
    })
})

describe('rotas do PDV em lote', () => {
    let tx: any
    beforeEach(() => {
        for (const k of Object.keys(db)) delete db[k]
        tx = {
            deliveryCourier: { upsert: vi.fn() },
            courierPayable: { upsert: vi.fn(), updateMany: vi.fn() },
        }
        db.$transaction = vi.fn(async (fn: any) => fn(tx))
        db.deliveryCourier = { findMany: vi.fn(async () => [{ id: HENRIQUE }]) }
    })

    it('motoboys: upsert pelo Uuid, liga as entregas que chegaram antes e um item ruim não derruba o lote', async () => {
        const r = resposta()
        await postCouriersSync({ body: [{ Uuid: HENRIQUE, Nome: 'Henrique', FormaGanho: 'FIXO', ValorPorEntrega: 7, Diaria: 30, Ativo: true }, { Uuid: 'nao-e-uuid', Nome: 'X' }] } as any, r)
        expect(r.code).toBe(200)
        expect(r.body.Recebidos).toBe(1)
        expect(r.body.Ignorados).toEqual([{ Uuid: 'nao-e-uuid', Motivo: expect.stringContaining('Uuid') }])
        expect(tx.deliveryCourier.upsert.mock.calls[0][0].where).toEqual({ id: HENRIQUE })
        expect(tx.courierPayable.updateMany).toHaveBeenCalledWith({ where: { courier_uuid: HENRIQUE, courier_id: null }, data: { courier_id: HENRIQUE } })
    })

    it('entregas: motoboy que ainda não subiu fica guardado pelo uuid, sem ligar', async () => {
        const r = resposta()
        await postCourierPayablesSync({ body: [
            { Uuid: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb1', MotoboyUuid: HENRIQUE, Tipo: 'ENTREGA', Dia: '2026-10-15', ValorAPagar: 7, Situacao: 'PENDENTE' },
            { Uuid: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb2', MotoboyUuid: NOVO, Tipo: 'DIARIA', Dia: '2026-10-15', ValorAPagar: 30, Situacao: 'PAGA', FormaPagamento: 'Dinheiro' },
        ] } as any, r)
        expect(r.body.Recebidos).toBe(2)
        const [conhecido, desconhecido] = tx.courierPayable.upsert.mock.calls.map((c: any) => c[0].create)
        expect(conhecido).toMatchObject({ courier_uuid: HENRIQUE, courier_id: HENRIQUE })
        expect(desconhecido).toMatchObject({ courier_uuid: NOVO, courier_id: null, kind: 'DIARIA', status: 'PAGA' })
    })

    it('corpo que não é lista: 400', async () => {
        const r = resposta()
        await postCourierPayablesSync({ body: { Uuid: 'x' } } as any, r)
        expect(r.code).toBe(400)
    })
})

describe('relatório dos motoboys', () => {
    const motoboys = [
        { id: HENRIQUE, name: 'Henrique', active: true, earning_mode: 'FIXO', value_per_delivery: 7, daily_rate: 30 },
        { id: 'parado', name: 'Antigo', active: false, earning_mode: 'FIXO', value_per_delivery: 7, daily_rate: 0 },
    ]
    const linhas = [
        { courier_uuid: HENRIQUE, kind: 'ENTREGA', day: '2026-10-14', amount_due: 7, status: 'PAGA', payment_method: 'Dinheiro' },
        { courier_uuid: HENRIQUE, kind: 'ENTREGA', day: '2026-10-15', amount_due: 7, status: 'PAGA', payment_method: 'Pix' },
        { courier_uuid: HENRIQUE, kind: 'ENTREGA', day: '2026-10-15', amount_due: 7, status: 'PENDENTE', payment_method: null },
        { courier_uuid: HENRIQUE, kind: 'ENTREGA', day: '2026-10-15', amount_due: 7, status: 'NAO_PAGA', payment_method: null },
        { courier_uuid: HENRIQUE, kind: 'DIARIA', day: '2026-10-15', amount_due: 30, status: 'PAGA', payment_method: 'Pix' },
        { courier_uuid: NOVO, kind: 'ENTREGA', day: '2026-10-15', amount_due: 8.5, status: 'PENDENTE', payment_method: null },
    ]

    it('por motoboy: entregas, diárias, ganho, pago por forma, pendente e o dia a dia; "não paga" fica fora do ganho', () => {
        const r = relatorioDosMotoboys(linhas, motoboys)
        const h = r.motoboys.find(m => m.id === HENRIQUE)!
        expect(h).toMatchObject({ entregas: 3, diarias: 1, nao_pagas: 1, ganho: 51, pago: 44, pago_dinheiro: 7, pago_pix: 37, pendente: 7 })
        expect(h.dias.map(d => [d.dia, d.ganho, d.pendente])).toEqual([['2026-10-14', 7, 0], ['2026-10-15', 44, 7]])
        // motoboy que ainda não subiu aparece; o inativo sem entregas não
        expect(r.motoboys.find(m => m.id === NOVO)).toMatchObject({ sem_cadastro: true, pendente: 8.5 })
        expect(r.motoboys.some(m => m.id === 'parado')).toBe(false)
        expect(r.totais).toMatchObject({ ganho: 59.5, pago: 44, pendente: 15.5 })
    })

    it('a rota usa o período (padrão: do dia 1º até hoje) e filtra pelo dia', async () => {
        for (const k of Object.keys(db)) delete db[k]
        db.courierPayable = { findMany: vi.fn(async () => linhas) }
        db.deliveryCourier = { findMany: vi.fn(async () => motoboys) }
        const r = resposta()
        await getCouriersReport({ query: { startDate: '2026-10-01', endDate: '2026-10-15' } } as any, r)
        expect(db.courierPayable.findMany.mock.calls[0][0].where).toEqual({ day: { gte: '2026-10-01', lte: '2026-10-15' } })
        expect(r.body.periodo).toEqual({ startDate: '2026-10-01', endDate: '2026-10-15' })
        expect(r.body.motoboys).toHaveLength(2)
    })
})
