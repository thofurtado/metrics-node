import { describe, it, expect, vi } from 'vitest'

// Fase 4 do Mergulho (17:U6): a renovação do token usa o papel do banco (a web agora renova sozinha antes de vencer).
const usuarios: Record<string, any> = { u1: { role: 'TECHNICIAN' } }
vi.mock('@/lib/prisma', () => ({
    prisma: {
        user: { findUnique: async ({ where }: any) => usuarios[where.id] ?? null },
        userModule: { findMany: async () => [{ module: { name: 'Atendimento' } }] },
    },
}))

import { refresh } from './refresh'

function fakeRequest(sub: string, roleNoToken: string) {
    return {
        user: { sub, role: roleNoToken, tenantDomain: 'loja.metrics.dev.br' },
        jwtVerify: async (opts?: any) => {
            if (opts?.onlyCookie) throw new Error('sem cookie')
        },
    } as any
}

function fakeReply() {
    const r: any = { code: 0, body: null, assinados: [] as any[] }
    r.jwtSign = async (payload: any) => { r.assinados.push(payload); return 'token-novo' }
    r.setCookie = () => r
    r.status = (c: number) => { r.code = c; return r }
    r.send = (b: any) => { r.body = b; return r }
    return r
}

describe('PATCH /token/refresh (17:U6)', () => {
    it('o token novo leva o papel do banco, não o do token antigo (admin rebaixado deixa de ser admin)', async () => {
        const reply = fakeReply()
        await refresh(fakeRequest('u1', 'ADMIN'), reply)
        expect(reply.code).toBe(200)
        expect(reply.assinados[0]).toMatchObject({ role: 'TECHNICIAN', modules: ['Atendimento'], tenantDomain: 'loja.metrics.dev.br' })
    })

    it('usuário apagado não renova', async () => {
        const reply = fakeReply()
        await refresh(fakeRequest('sumiu', 'ADMIN'), reply)
        expect(reply.code).toBe(401)
        expect(reply.assinados).toHaveLength(0)
    })
})
