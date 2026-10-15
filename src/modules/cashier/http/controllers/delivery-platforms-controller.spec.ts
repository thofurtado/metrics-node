import { beforeEach, describe, expect, it, vi } from 'vitest'

// Cadastro das plataformas (15/10/2026, plano 2.1), com o banco simulado.
const db: any = vi.hoisted(() => ({}))
vi.mock('@/lib/prisma', () => ({ prisma: db }))

import { createDeliveryPlatform, deleteDeliveryPlatform, updateDeliveryPlatform } from './delivery-platforms-controller'

function resposta() {
    const r: any = { code: 0, body: null }
    r.status = (c: number) => { r.code = c; return r }
    r.send = (b: any) => { r.body = b; return r }
    return r
}

const ID = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc'

describe('cadastro das plataformas', () => {
    beforeEach(() => {
        for (const k of Object.keys(db)) delete db[k]
        db.deliveryPlatform = {
            findUnique: vi.fn(async () => null),
            create: vi.fn(async ({ data }: any) => ({ id: ID, ...data })),
            update: vi.fn(async ({ data }: any) => ({ id: ID, ...data })),
            delete: vi.fn(),
        }
        db.account = { findUnique: vi.fn(async () => ({ id: 'conta' })) }
        db.transaction = { count: vi.fn(async () => 0) }
    })

    it('cria o iFood com as taxas da Katatau; o código vira IFOOD; sem conta = Conta de Transação', async () => {
        const r = resposta()
        await createDeliveryPlatform({ body: { code: 'iFood', name: 'iFood', commission_own_delivery_pct: 12, commission_platform_delivery_pct: 23, online_payment_fee_pct: 3.2, payout_weeks_after: 4 } } as any, r)
        expect(r.code).toBe(201)
        expect(db.deliveryPlatform.create.mock.calls[0][0].data).toMatchObject({ code: 'IFOOD', account_id: null, monthly_fee: 0, active: true, payout_weeks_after: 4 })
    })

    it('código repetido, percentual fora de 0 a 100 e semanas menor que 1 são recusados', async () => {
        db.deliveryPlatform.findUnique = vi.fn(async () => ({ id: 'outra' }))
        const repetido = resposta()
        await createDeliveryPlatform({ body: { code: '99FOOD', name: '99Food' } } as any, repetido)
        expect(repetido.code).toBe(400)
        expect(repetido.body.message).toContain('99FOOD')

        const pct = resposta()
        await createDeliveryPlatform({ body: { code: 'X', name: 'X', commission_own_delivery_pct: 120 } } as any, pct)
        expect(pct.code).toBe(400)

        const semanas = resposta()
        await createDeliveryPlatform({ body: { code: 'X', name: 'X', payout_weeks_after: 0 } } as any, semanas)
        expect(semanas.code).toBe(400)
    })

    it('editar: null tira a conta; sem o campo, não mexe', async () => {
        db.deliveryPlatform.findUnique = vi.fn(async ({ where }: any) => (where.id === ID ? { id: ID } : null))
        const r = resposta()
        await updateDeliveryPlatform({ params: { id: ID }, body: { account_id: null, online_payment_fee_pct: 3.5 } } as any, r)
        expect(r.code).toBe(200)
        expect(db.deliveryPlatform.update.mock.calls[0][0].data).toMatchObject({ account_id: null, online_payment_fee_pct: 3.5 })

        await updateDeliveryPlatform({ params: { id: ID }, body: { name: 'iFood Loja' } } as any, resposta())
        expect(db.deliveryPlatform.update.mock.calls[1][0].data.account_id).toBeUndefined()
    })

    it('excluir com repasse ou comissão lançados: recusa (desative em vez de excluir)', async () => {
        db.deliveryPlatform.findUnique = vi.fn(async () => ({ id: ID }))
        db.transaction.count = vi.fn(async () => 3)
        const r = resposta()
        await deleteDeliveryPlatform({ params: { id: ID } } as any, r)
        expect(r.code).toBe(409)
        expect(db.deliveryPlatform.delete).not.toHaveBeenCalled()
    })
})
