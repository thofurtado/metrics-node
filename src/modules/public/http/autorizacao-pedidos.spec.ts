import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

// Fase 0 do Mergulho (02:P1): os pedidos da loja pedem a chave do PDV ou o login da própria loja.
let bancoDaChamada = 'db_marujo'
vi.mock('@fastify/request-context', () => ({ requestContext: { get: (k: string) => (k === 'tenant' ? bancoDaChamada : undefined) } }))
vi.mock('@/lib/tenant-manager', () => ({
    getDbNameForDomain: async (d: string) => ({ 'marujo.metrics.dev.br': 'db_marujo', 'katatau.metrics.dev.br': 'db_katatau' } as any)[d] ?? null,
}))
vi.mock('@/modules/pdv-sync/http/controllers/routes', () => ({ chaveDoPdvValida: (h: unknown) => h === 'chave-certa' }))

import { chaveOuLoginNaTransicao, exigirChaveOuLogin, quemPede } from './autorizacao-pedidos'

function pedido(headers: Record<string, string> = {}, login?: { tenantDomain?: string } | 'invalido') {
    return {
        headers,
        url: '/api/pdv/orders/pending',
        routeOptions: { url: '/api/pdv/orders/pending' },
        cookies: {},
        jwtVerify: vi.fn(async () => {
            if (!login || login === 'invalido') throw new Error('sem login')
            return login
        }),
    } as any
}

function resposta() {
    const r: any = { code: 0, body: null }
    r.status = (c: number) => { r.code = c; return r }
    r.send = (b: any) => { r.body = b; return r }
    return r
}

describe('quem pode mexer nos pedidos da loja', () => {
    beforeEach(() => { bancoDaChamada = 'db_marujo'; delete process.env.PEDIDOS_EXIGIR_CHAVE })
    afterEach(() => { delete process.env.PEDIDOS_EXIGIR_CHAVE })

    it('a chave do PDV vale', async () => {
        expect(await quemPede(pedido({ 'x-api-key': 'chave-certa' }))).toBe('pdv')
    })

    it('o login da própria loja vale', async () => {
        expect(await quemPede(pedido({ authorization: 'Bearer abc' }, { tenantDomain: 'marujo.metrics.dev.br' }))).toBe('login')
    })

    it('login de OUTRA loja não abre os pedidos desta', async () => {
        expect(await quemPede(pedido({ authorization: 'Bearer abc' }, { tenantDomain: 'katatau.metrics.dev.br' }))).toBeNull()
    })

    it('login vencido ou falso não vale; chave errada também não', async () => {
        expect(await quemPede(pedido({ authorization: 'Bearer abc' }, 'invalido'))).toBeNull()
        expect(await quemPede(pedido({ 'x-api-key': 'chave-errada' }))).toBeNull()
        expect(await quemPede(pedido())).toBeNull()
    })

    it('rota só da web: sem chave nem login, 401 desde já', async () => {
        const r = resposta()
        await exigirChaveOuLogin(pedido(), r)
        expect(r.code).toBe(401)
        const ok = resposta()
        await exigirChaveOuLogin(pedido({ authorization: 'Bearer abc' }, { tenantDomain: 'marujo.metrics.dev.br' }), ok)
        expect(ok.code).toBe(0)
    })

    it('rota do PDV no passo 1: o PDV 2.5.53.0, sem chave, continua funcionando', async () => {
        const r = resposta()
        await chaveOuLoginNaTransicao(pedido(), r)
        expect(r.code).toBe(0)
    })

    it('rota do PDV no passo 2 (PEDIDOS_EXIGIR_CHAVE=true): sem chave, 401; com a chave, passa', async () => {
        process.env.PEDIDOS_EXIGIR_CHAVE = 'true'
        const sem = resposta()
        await chaveOuLoginNaTransicao(pedido(), sem)
        expect(sem.code).toBe(401)
        const com = resposta()
        await chaveOuLoginNaTransicao(pedido({ 'x-api-key': 'chave-certa' }), com)
        expect(com.code).toBe(0)
    })
})
