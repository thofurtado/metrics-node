import { beforeEach, describe, expect, it, vi } from 'vitest'

// Fase 4 do Mergulho (02:P14): a recusa do iFood/99 ao confirmar ou despachar voltava como sucesso para o PDV.
const db: any = vi.hoisted(() => ({
    pedido: { findFirst: vi.fn(), update: vi.fn(async ({ data }: any) => ({ uuid: 'p1', display_id: 9, valor_final: 50, ...data })) },
    companyProfile: { findFirst: vi.fn(async () => null) },
    client: { findUnique: vi.fn(async () => null) },
    cashierEntry: { create: vi.fn() },
}))
const plataforma = vi.hoisted(() => ({ resposta: true as boolean | Promise<boolean> }))
vi.mock('@fastify/request-context', () => ({ requestContext: { get: (k: string) => (k === 'prisma' ? db : 'db_teste') } }))
vi.mock('@/lib/sse-manager', () => ({ sseManager: { notifyTenant: vi.fn() }, bancoDaRequisicao: () => 'db_teste' }))
vi.mock('@/lib/web-push-manager', () => ({ webPushManager: { notifyOrderStatus: vi.fn() } }))
vi.mock('@/modules/delivery/services/ifood-events.service', () => ({ writeJournal: vi.fn() }))
vi.mock('@/modules/delivery/services/delivery-order-lifecycle.service', () => ({
    extractIfoodOrderId: () => null,
    cancelDeliveryOrderOnPlatform: vi.fn(async () => ({ handled: false, ok: true })),
    handleDeliveryOrderStatusChange: vi.fn(async () => plataforma.resposta),
}))

import { updateOnlineOrderStatus } from './update-online-order-status'

function resposta() {
    const r: any = { code: 0, body: null }
    r.status = (c: number) => { r.code = c; return r }
    r.send = (b: any) => { r.body = b; return r }
    return r
}

describe('mudança de situação de pedido do iFood/99 (02:P14)', () => {
    beforeEach(() => {
        db.pedido.findFirst.mockResolvedValue({ id: 1, uuid: 'p1', status: 'Aberto', origem: 'Delivery', observacao: '[iFood: abc]', display_id: 9 })
    })

    it('o iFood recusou a confirmação: a resposta diz (platform_ok = false) e a situação na nuvem muda mesmo assim', async () => {
        plataforma.resposta = false
        const r = resposta()
        await updateOnlineOrderStatus({ params: { id: 'p1' }, body: { status: 'in_preparation' } } as any, r)
        expect(r.code).toBe(200)
        expect(r.body.platform_ok).toBe(false)
        expect(r.body.platform_message).toContain('não confirmou')
        expect(db.pedido.update).toHaveBeenCalled()
    })

    it('a plataforma confirmou: platform_ok = true e sem mensagem', async () => {
        plataforma.resposta = true
        const r = resposta()
        await updateOnlineOrderStatus({ params: { id: 'p1' }, body: { status: 'dispatched' } } as any, r)
        expect(r.body.platform_ok).toBe(true)
        expect(r.body.platform_message).toBeNull()
    })
})
