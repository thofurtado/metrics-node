import { afterEach, describe, expect, it, vi } from 'vitest'

// Fase 0 do Mergulho (02:P1): o canal ao vivo mandava nome, telefone e endereço dos clientes para quem soubesse o domínio.
const db: any = vi.hoisted(() => ({ pedido: { findMany: vi.fn(async () => []) } }))
const sse = vi.hoisted(() => ({ addConnection: vi.fn(() => ({})), removeConnection: vi.fn() }))
vi.mock('@fastify/request-context', () => ({ requestContext: { get: (k: string) => (k === 'prisma' ? db : 'db_teste') } }))
vi.mock('@/lib/sse-manager', () => ({ sseManager: sse, bancoDaRequisicao: () => 'db_teste' }))
vi.mock('@/lib/tenant-manager', () => ({ getDbNameForDomain: async () => 'db_teste' }))
vi.mock('@/modules/pdv-sync/http/controllers/routes', () => ({ chaveDoPdvValida: (h: unknown) => h === 'chave-certa' }))
vi.mock('./pedido-online-dto', () => ({ montarPedidosOnline: async () => [] }))

import { ordersStream } from './orders-stream'

function canal(headers: Record<string, string> = {}) {
    const escrito: string[] = []
    const request: any = { headers, cookies: {}, raw: { on: vi.fn() }, jwtVerify: vi.fn(async () => { throw new Error('sem login') }) }
    const reply: any = { raw: { writeHead: vi.fn(), write: (t: string) => escrito.push(t) }, status: () => reply, send: () => reply }
    return { request, reply, escrito }
}

describe('canal ao vivo dos pedidos (02:P1)', () => {
    afterEach(() => { delete process.env.PEDIDOS_EXIGIR_CHAVE; vi.clearAllMocks() })

    it('com a chave do PDV: pedido inteiro', async () => {
        const c = canal({ 'x-api-key': 'chave-certa' })
        await ordersStream(c.request, c.reply)
        expect(sse.addConnection.mock.calls[0][2]).toBe(true)
        expect(db.pedido.findMany).toHaveBeenCalled()
    })

    it('sem chave, no passo 1: pedido inteiro (o PDV 2.5.53.0 grava o pedido pelo canal)', async () => {
        const c = canal()
        await ordersStream(c.request, c.reply)
        expect(sse.addConnection.mock.calls[0][2]).toBe(true)
    })

    it('sem chave, no passo 2: só o aviso, e os pendentes não são despejados no canal', async () => {
        process.env.PEDIDOS_EXIGIR_CHAVE = 'true'
        const c = canal()
        await ordersStream(c.request, c.reply)
        expect(sse.addConnection.mock.calls[0][2]).toBe(false)
        expect(db.pedido.findMany).not.toHaveBeenCalled()
    })
})
