import { beforeEach, describe, expect, it, vi } from 'vitest'

// Fase 2 do Mergulho (02:P3): dois pedidos de mesmo valor em 2 minutos viravam um só.
const db: any = {
    companyProfile: { findFirst: vi.fn(async () => null) },
    client: {
        findUnique: vi.fn(async () => null),
        findFirst: vi.fn(async () => ({ id: 'cli-1', name: 'Cliente', phone: '00000000000', addresses: [] })),
        create: vi.fn(async ({ data }: any) => ({ id: 'cli-novo', name: data.name, phone: data.phone, addresses: [] })),
        update: vi.fn(),
    },
    address: { create: vi.fn(async () => ({ id: 'end-1' })) },
    pedido: {
        findFirst: vi.fn(),
        count: vi.fn(async () => 3),
        create: vi.fn(async ({ data }: any) => ({ uuid: data.uuid ?? 'novo', display_id: data.display_id, valor_final: data.valor_final, status_delivery: data.status_delivery, itens: [] })),
    },
    cashierSession: { findFirst: vi.fn(async () => null) },
}
vi.mock('@fastify/request-context', () => ({ requestContext: { get: (k: string) => (k === 'prisma' ? db : 'db_teste') } }))
vi.mock('@/lib/sse-manager', () => ({ sseManager: { notifyTenant: vi.fn() }, bancoDaRequisicao: () => 'db_teste' }))

import { createOnlineOrder } from './create-online-order'

function resposta() {
    const r: any = { code: 0, body: null }
    r.status = (c: number) => { r.code = c; return r }
    r.send = (b: any) => { r.body = b; return r }
    return r
}

const pedidoAnterior = { uuid: 'anterior', display_id: 1, valor_final: 30, status_delivery: 'Pendente', itens: [] }

function pedidoDoPdv(extra: Record<string, unknown> = {}) {
    return {
        body: { origin: 'PDV', client_name: 'Ana', client_phone: '00000000000', street: 'Retirada Balcão', total_amount: 30, items: [], ...extra },
        headers: {},
        query: {},
    } as any
}

describe('trava de pedido repetido (02:P3)', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        // Primeira busca: pelo código do pedido (não existe). Qualquer outra: o pedido de R$ 30 de 1 minuto atrás.
        db.pedido.findFirst.mockImplementation(async ({ where }: any) => (where.uuid ? null : pedidoAnterior))
    })

    it('o 2º pedido do PDV (com código próprio) de mesmo valor em 2 minutos entra como pedido novo', async () => {
        const r = resposta()
        await createOnlineOrder(pedidoDoPdv({ uuid: '7c9e6679-7425-40de-944b-e07fc1f90ae7', client_phone: '11999990000' }), r)
        expect(r.code).toBe(201)
        expect(r.body.order.id).toBe('7c9e6679-7425-40de-944b-e07fc1f90ae7')
        expect(db.pedido.create).toHaveBeenCalledTimes(1)
    })

    it('pedido sem telefone nunca é "repetição" de outro (todos caíam no mesmo cliente)', async () => {
        const r = resposta()
        await createOnlineOrder(pedidoDoPdv(), r)
        expect(r.code).toBe(201)
        expect(db.pedido.create).toHaveBeenCalledTimes(1)
    })

    it('o cardápio (sem código, com telefone) continua protegido do clique duplo', async () => {
        const r = resposta()
        await createOnlineOrder({ ...pedidoDoPdv({ origin: 'Delivery', client_phone: '11999990000', street: 'Rua A', neighborhood: 'Centro' }) }, r)
        expect(r.code).toBe(200)
        expect(r.body.order.id).toBe('anterior')
        expect(db.pedido.create).not.toHaveBeenCalled()
    })

    it('reenvio do mesmo pedido do PDV devolve o mesmo pedido, sem criar outro', async () => {
        db.pedido.findFirst.mockImplementation(async ({ where }: any) => (where.uuid ? { ...pedidoAnterior, uuid: where.uuid } : null))
        const r = resposta()
        await createOnlineOrder(pedidoDoPdv({ uuid: '7c9e6679-7425-40de-944b-e07fc1f90ae7' }), r)
        expect(r.code).toBe(200)
        expect(r.body.order.id).toBe('7c9e6679-7425-40de-944b-e07fc1f90ae7')
        expect(db.pedido.create).not.toHaveBeenCalled()
    })

    it('sem telefone, o cliente só é reaproveitado com o mesmo nome; o código do cliente do PDV vem antes', async () => {
        await createOnlineOrder(pedidoDoPdv(), resposta())
        expect(db.client.findFirst.mock.calls[0][0].where.name).toEqual({ equals: 'Ana', mode: 'insensitive' })

        db.client.findUnique.mockResolvedValueOnce({ id: 'cli-pdv', name: 'Ana', phone: null, addresses: [] })
        await createOnlineOrder(pedidoDoPdv({ client_id: '0b0c0d0e-0000-4000-8000-000000000001' }), resposta())
        expect(db.pedido.create.mock.calls.at(-1)![0].data.cliente_id).toBe('cli-pdv')
    })
})
