import { beforeEach, describe, expect, it, vi } from 'vitest'

// Módulo Vendas, etapa 3 (16/10/2026): a nuvem passa a guardar o número do pedido no PDV, a senha do dia e o cliente da
// venda (o PDV sempre mandou DisplayId, NumeroDiario e ClienteUuid). Banco simulado.
const db: any = vi.hoisted(() => ({}))
vi.mock('@/lib/prisma', () => ({ prisma: db }))

import { postSalesSync } from './sales-sync-controller'
import { numeracaoQueFalta } from '../../services/dados-da-venda'

function resposta() {
    const r: any = { code: 0, body: null }
    r.status = (c: number) => { r.code = c; return r }
    r.send = (b: any) => { r.body = b; return r }
    return r
}

const CAIXA = '33333333-3333-4333-8333-333333333333'
const VENDA = '44444444-4444-4444-8444-444444444445'
const ITEM = '77777777-7777-4777-8777-777777777775'
const CLIENTE = '55555555-5555-4555-8555-555555555555'
const CLIENTE_QUE_NAO_SUBIU = '55555555-5555-4555-8555-555555555556'

describe('número, senha e cliente da venda', () => {
    let tx: any
    beforeEach(() => {
        for (const k of Object.keys(db)) delete db[k]
        tx = {
            sale: { findUnique: vi.fn(async () => null), upsert: vi.fn(async () => ({})), update: vi.fn(), updateMany: vi.fn(async () => ({ count: 1 })) },
            cashierSession: { findUnique: vi.fn(async () => ({ status: 'OPEN' })) },
            cashierEntry: { findMany: vi.fn(async () => []), deleteMany: vi.fn(), create: vi.fn(), updateMany: vi.fn() },
            saleItem: { findMany: vi.fn(async () => []), findUnique: vi.fn(async () => null), create: vi.fn(), update: vi.fn() },
            clientTab: { findMany: vi.fn(async () => []), deleteMany: vi.fn(), update: vi.fn(), create: vi.fn() },
            client: { findUnique: vi.fn(async ({ where }: any) => (where.id === CLIENTE ? { id: CLIENTE } : null)) },
            employee: { findFirst: vi.fn(async () => null) },
            product: { findUnique: vi.fn(async () => null) },
        }
        db.paymentIdentifier = { findMany: vi.fn(async () => []) }
        db.pOSMachine = { findMany: vi.fn(async () => []) }
        db.$transaction = vi.fn(async (fn: any) => fn(tx))
    })

    const venda = (extra: Record<string, any> = {}) => ({
        Uuid: VENDA, CashierSessionId: CAIXA, Origin: 'Balcao', TotalAmount: 30, Payments: [{ Method: 'Dinheiro', Amount: 30 }],
        Items: [{ Uuid: ITEM, Quantity: 1, UnitPrice: 30 }], ...extra,
    })

    it('venda nova guarda o número, a senha e o cliente que já está na nuvem', async () => {
        const r = resposta()
        await postSalesSync({ body: [venda({ DisplayId: 1234, NumeroDiario: 7, ClienteUuid: CLIENTE })] } as any, r)
        expect(r.code).toBe(201)
        const { create, update } = tx.sale.upsert.mock.calls[0][0]
        expect(create).toMatchObject({ display_id: 1234, daily_number: 7, client_id: CLIENTE })
        expect(update).toMatchObject({ display_id: 1234, daily_number: 7, client_id: CLIENTE })
    })

    it('cliente que ainda não subiu fica de fora (não trava a venda); número zero não é gravado', async () => {
        await postSalesSync({ body: [venda({ DisplayId: 0, NumeroDiario: null, ClienteUuid: CLIENTE_QUE_NAO_SUBIU })] } as any, resposta())
        const { create } = tx.sale.upsert.mock.calls[0][0]
        for (const campo of ['display_id', 'daily_number', 'client_id']) expect(create).not.toHaveProperty(campo)
    })

    it('reenvio igual de venda antiga (até de caixa conferido): só completa o vazio, sem mexer no dinheiro', async () => {
        tx.sale.findUnique = vi.fn(async () => ({ cashier_session_id: CAIXA, total_amount: 30, discount: 0, status: 'COMPLETED', origin: 'Balcao', display_id: null, daily_number: null, client_id: null }))
        tx.cashierSession.findUnique = vi.fn(async () => ({ status: 'CHECKED' }))
        tx.cashierEntry.findMany = vi.fn(async () => [{ id: 'e1', identification: `Balcao - Pedido #${VENDA.slice(0, 8)}`, payment_method: 'Dinheiro', amount: 30, platform_code: null, platform_own_delivery: null }])
        tx.saleItem.findMany = vi.fn(async () => [{ id: ITEM, sold_name: null, seller_employee_id: null, seller_name: null, seller_number: null, complements: null, note: null }])
        const r = resposta()
        await postSalesSync({ body: [venda({ DisplayId: 1234, NumeroDiario: 7 })] } as any, r)
        expect(r.code).toBe(201)
        expect(tx.sale.upsert).not.toHaveBeenCalled()
        expect(tx.cashierEntry.create).not.toHaveBeenCalled()
        expect(tx.sale.update).toHaveBeenCalledWith({ where: { id: VENDA }, data: { display_id: 1234, daily_number: 7 } })
    })

    it('o que já está gravado não muda', () => {
        expect(numeracaoQueFalta({ display_id: 1, daily_number: 2, client_id: 'c' }, { display_id: 9, daily_number: 9, client_id: 'x' })).toEqual({})
        expect(numeracaoQueFalta({ display_id: 1, daily_number: null }, { display_id: 9, daily_number: 9 })).toEqual({ daily_number: 9 })
    })
})
