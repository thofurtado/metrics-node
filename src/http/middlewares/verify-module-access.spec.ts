import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// Fase 0 do Mergulho (17:U1): a trava de módulo segue a mesma regra da web (hasAccess) e lê o papel e os módulos do banco.
const usuarios: Record<string, any> = {}
vi.mock('@/lib/prisma', () => ({
    prisma: {
        user: {
            findUnique: async ({ where }: any) => usuarios[where.id] ?? null,
        },
    },
}))

import { canUseModule, verifyModuleAccess, verifyModuleAccessPainel } from './verify-module-access'

function fakeReply() {
    const r: any = { code: 0, body: null }
    r.status = (c: number) => { r.code = c; return r }
    r.send = (b: any) => { r.body = b; return r }
    return r
}

function comModulos(role: string, slugs: string[]) {
    return { role, userModules: slugs.map(slug => ({ module: { slug } })) }
}

beforeEach(() => {
    for (const k of Object.keys(usuarios)) delete usuarios[k]
    usuarios.dono = comModulos('ADMIN', []) // dono sem nenhuma linha em user_modules (existe em produção)
    usuarios.caixa = comModulos('CASHIER', [])
    usuarios.tecnico = comModulos('TECHNICIAN', ['service', 'items'])
    usuarios.financeiro = comModulos('TECHNICIAN', ['finance'])
})

describe('canUseModule (mesma regra da web)', () => {
    it('ADMIN passa em tudo, mesmo sem módulos', () => {
        expect(canUseModule('ADMIN', [], ['finance'])).toBe(true)
    })
    it('CASHIER só passa onde o Caixa é aceito', () => {
        expect(canUseModule('CASHIER', [], ['finance'])).toBe(false)
        expect(canUseModule('CASHIER', [], ['cashier', 'finance'])).toBe(true)
    })
    it('os outros precisam de um dos módulos aceitos', () => {
        expect(canUseModule('TECHNICIAN', ['service'], ['finance'])).toBe(false)
        expect(canUseModule('TECHNICIAN', ['service'], ['hr', 'service'])).toBe(true)
    })
})

describe('verifyModuleAccess', () => {
    it('barra com 403 o técnico sem o Financeiro (antes lia GET /transactions com o próprio token)', async () => {
        const reply = fakeReply()
        await verifyModuleAccess('finance')({ user: { sub: 'tecnico' } } as any, reply)
        expect(reply.code).toBe(403)
        expect(reply.body.code).toBe('MODULE_FORBIDDEN')
        expect(reply.body.message).toContain('Financeiro')
    })

    it('barra o caixa fora do Caixa e deixa passar no Caixa', async () => {
        const r1 = fakeReply()
        await verifyModuleAccess('hr')({ user: { sub: 'caixa' } } as any, r1)
        expect(r1.code).toBe(403)
        const r2 = fakeReply()
        await verifyModuleAccess('cashier', 'finance')({ user: { sub: 'caixa' } } as any, r2)
        expect(r2.code).toBe(0)
    })

    it('deixa passar o dono (ADMIN) mesmo sem módulos gravados e quem tem o módulo', async () => {
        const r1 = fakeReply()
        await verifyModuleAccess('finance')({ user: { sub: 'dono' } } as any, r1)
        expect(r1.code).toBe(0)
        const r2 = fakeReply()
        await verifyModuleAccess('finance')({ user: { sub: 'financeiro' } } as any, r2)
        expect(r2.code).toBe(0)
    })

    it('usa o papel do banco, não o do token (token antigo de ADMIN rebaixado não passa)', async () => {
        const reply = fakeReply()
        await verifyModuleAccess('finance')({ user: { sub: 'tecnico', role: 'ADMIN' } } as any, reply)
        expect(reply.code).toBe(403)
    })

    it('usuário apagado com token ainda válido recebe 401', async () => {
        const reply = fakeReply()
        await verifyModuleAccess('finance')({ user: { sub: 'sumiu' } } as any, reply)
        expect(reply.code).toBe(401)
    })

    it('chamada sem usuário (chave x-api-key) segue como antes', async () => {
        const reply = fakeReply()
        await verifyModuleAccess('finance')({ user: undefined, headers: { 'x-api-key': 'x' } } as any, reply)
        expect(reply.code).toBe(0)
    })
})

describe('verifyModuleAccessPainel (tela inicial do app Gerencial)', () => {
    const antes = process.env.TRAVA_MODULO_PAINEL
    afterEach(() => {
        if (antes === undefined) delete process.env.TRAVA_MODULO_PAINEL
        else process.env.TRAVA_MODULO_PAINEL = antes
    })

    it('sem a variável, não trava (o Gerencial instalado desloga em qualquer 403)', async () => {
        delete process.env.TRAVA_MODULO_PAINEL
        const reply = fakeReply()
        await verifyModuleAccessPainel('finance')({ user: { sub: 'tecnico' } } as any, reply)
        expect(reply.code).toBe(0)
    })

    it('com TRAVA_MODULO_PAINEL=1, trava como as outras', async () => {
        process.env.TRAVA_MODULO_PAINEL = '1'
        const reply = fakeReply()
        await verifyModuleAccessPainel('finance')({ user: { sub: 'tecnico' } } as any, reply)
        expect(reply.code).toBe(403)
    })
})
