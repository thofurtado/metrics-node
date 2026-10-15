import { describe, it, expect, vi, beforeAll, afterAll } from 'vitest'
import Fastify, { FastifyInstance } from 'fastify'
import fastifyJwt from '@fastify/jwt'

// Fase 0 do Mergulho (17:U1): confere nas rotas de verdade onde a trava de módulo vale e onde ficou de fora de propósito.
// O banco é falso: as rotas que passam pela trava caem no controlador e falham (500 ou 400), o que basta para provar
// que NÃO foram barradas (403).
const usuarios: Record<string, any> = {
    tecnico: { role: 'TECHNICIAN', userModules: [{ module: { slug: 'service' } }] },
    caixa: { role: 'CASHIER', userModules: [] },
    dono: { role: 'ADMIN', userModules: [] },
}
// Nada de banco de verdade aqui: o env e o gerente de lojas são falsos (o .env.test aponta para a produção).
vi.mock('@/env', () => ({ env: { NODE_ENV: 'test', JWT_SECRET: 'segredo-do-teste', PORT: 0 } }))
vi.mock('@/lib/tenant-manager', () => ({
    getDbNameForDomain: async () => null,
    getPrismaForDomain: async () => null,
    getMasterPool: async () => null,
    getActiveTenantDbNames: async () => [],
    getIfoodCredentials: async () => null,
    saveIfoodCredentials: async () => undefined,
    getPrismaForDb: async () => null,
}))
vi.mock('@/lib/prisma', () => {
    const qualquer: any = new Proxy({}, {
        get: (_t, nome) => {
            if (nome === 'user') return { findUnique: async ({ where }: any) => usuarios[where.id] ?? null, findMany: async () => [] }
            if (nome === 'then') return undefined
            return new Proxy({}, { get: () => async () => { throw new Error('banco falso') } })
        },
    })
    return { prisma: qualquer }
})

import { financialRoutes } from '@/modules/financial/http/controllers/routes'
import { hrAdminRoutes } from '@/modules/hr/http/controllers/routes'
import { cashierRoutes } from '@/modules/cashier/http/controllers/routes'
import { treatmentsRoutes } from '@/modules/treatments/http/controllers/routes'
import { metricsRoutes } from '@/modules/metrics/http/controllers/routes'
import { stockAdvancedRoutes } from '@/modules/stock/http/controllers/routes'
import { verifyJwt } from '@/http/middlewares/verify-jwt'

let app: FastifyInstance
const token: Record<string, string> = {}

beforeAll(async () => {
    app = Fastify()
    app.register(fastifyJwt, { secret: 'segredo-do-teste' })
    app.register(financialRoutes)
    app.register(cashierRoutes)
    app.register(treatmentsRoutes)
    app.register(metricsRoutes)
    app.register(stockAdvancedRoutes)
    app.register(async (instance) => {
        instance.addHook('onRequest', verifyJwt)
        instance.register(hrAdminRoutes)
    })
    await app.ready()
    for (const sub of Object.keys(usuarios)) {
        token[sub] = app.jwt.sign({ role: usuarios[sub].role, modules: [] }, { sub })
    }
})

afterAll(async () => {
    await app.close()
})

async function chamar(metodo: 'GET' | 'POST', url: string, quem: string) {
    const r = await app.inject({ method: metodo, url, headers: { authorization: `Bearer ${token[quem]}` } })
    return r.statusCode
}

describe('Trava de módulo nas rotas (17:U1)', () => {
    it('técnico só do Atendimento não lê transações, resumo de contas a prazo nem funcionários', async () => {
        expect(await chamar('GET', '/transactions', 'tecnico')).toBe(403)
        expect(await chamar('GET', '/settlements', 'tecnico')).toBe(403)
        expect(await chamar('GET', '/hr/employees', 'tecnico')).toBe(403)
        expect(await chamar('GET', '/hr/payroll/history', 'tecnico')).toBe(403)
        expect(await chamar('GET', '/api/cashier/sessions', 'tecnico')).toBe(403)
    })

    it('listas usadas por outras telas continuam abertas (contas, setores, formas de pagamento, feriados)', async () => {
        expect(await chamar('GET', '/accounts', 'tecnico')).not.toBe(403)
        expect(await chamar('GET', '/sectors', 'tecnico')).not.toBe(403)
        expect(await chamar('GET', '/payments', 'tecnico')).not.toBe(403)
        expect(await chamar('GET', '/hr/holidays', 'tecnico')).not.toBe(403)
        expect(await chamar('GET', '/api/payment-methods', 'tecnico')).not.toBe(403)
    })

    it('a tela inicial do app Gerencial não trava sem TRAVA_MODULO_PAINEL', async () => {
        delete process.env.TRAVA_MODULO_PAINEL
        expect(await chamar('GET', '/summary', 'tecnico')).not.toBe(403)
        expect(await chamar('GET', '/dashboard/operacional', 'tecnico')).not.toBe(403)
    })

    it('o caixa (CASHIER) usa o caixa da web, mas não o financeiro nem o RH', async () => {
        expect(await chamar('GET', '/api/cashier/sessions', 'caixa')).not.toBe(403)
        expect(await chamar('GET', '/accounts', 'caixa')).not.toBe(403)
        expect(await chamar('GET', '/transactions', 'caixa')).toBe(403)
        expect(await chamar('GET', '/hr/employees', 'caixa')).toBe(403)
    })

    it('o dono (ADMIN) passa em tudo, mesmo sem módulos gravados', async () => {
        expect(await chamar('GET', '/transactions', 'dono')).not.toBe(403)
        expect(await chamar('GET', '/hr/employees', 'dono')).not.toBe(403)
        expect(await chamar('GET', '/api/cashier/sessions', 'dono')).not.toBe(403)
    })

    it('sem token continua 401', async () => {
        const r = await app.inject({ method: 'GET', url: '/transactions' })
        expect(r.statusCode).toBe(401)
    })

    it('Atendimento, números do painel e estoque avançado seguem o módulo de cada um', async () => {
        expect(await chamar('GET', '/treatments', 'caixa')).toBe(403)
        expect(await chamar('GET', '/treatments', 'tecnico')).not.toBe(403)
        expect(await chamar('GET', '/service-management', 'caixa')).not.toBe(403) // tela inicial do Gerencial
        expect(await chamar('GET', '/metrics/month-expense-by-sector', 'tecnico')).toBe(403)
        expect(await chamar('GET', '/metrics/month-treatments-amount', 'tecnico')).not.toBe(403)
        expect(await chamar('GET', '/api/stock/overview', 'tecnico')).toBe(403)
        expect(await chamar('GET', '/api/stock/overview', 'dono')).not.toBe(403)
    })
})
