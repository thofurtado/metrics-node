import { beforeEach, describe, expect, it, vi } from 'vitest'

// Observação rápida (só no salão), 16/10/2026: o grupo marcado grava as opções com preço zero.
const estado: any = {}

function tx() {
    return {
        complementGroup: {
            create: async ({ data }: any) => {
                estado.criado = data
                return { id: 'g-novo', ...data, options: data.options?.create ?? [] }
            },
            findUnique: async () => (estado.grupoAtual ? { quick_note: estado.grupoAtual.quick_note } : null),
            update: async ({ data }: any) => {
                estado.grupoAtualizado = data
                return { id: 'g1', ...data, options: [], products: [] }
            },
        },
        complementOption: {
            findMany: async () => estado.opcoesAtuais,
            deleteMany: async () => ({ count: 0 }),
            update: async ({ where, data }: any) => { estado.opcoesAtualizadas.push({ id: where.id, ...data }) },
            create: async ({ data }: any) => { estado.opcoesCriadas.push(data) },
            updateMany: async (args: any) => { estado.zeradas.push(args) },
        },
        productComplementGroup: {
            createMany: async () => ({ count: 0 }),
            deleteMany: async () => ({ count: 0 }),
        },
    }
}

vi.mock('@/lib/prisma', () => ({
    prisma: { $transaction: async (fn: any) => fn(tx()) },
}))

import { createComplementGroup, updateComplementGroup } from './complement-groups'

const G1 = '11111111-1111-4111-8111-111111111111'

function fakeReply() {
    const r: any = { code: 0, body: null }
    r.status = (c: number) => { r.code = c; return r }
    r.send = (b?: any) => { r.body = b; return r }
    return r
}

beforeEach(() => {
    estado.criado = null
    estado.grupoAtual = null
    estado.grupoAtualizado = null
    estado.opcoesAtuais = [{ id: 'o1', group_id: G1 }]
    estado.opcoesAtualizadas = []
    estado.opcoesCriadas = []
    estado.zeradas = []
})

describe('Grupo de complementos: observação rápida (só no salão)', () => {
    it('criar marcado grava quick_note e as opções com preço zero, mesmo que a tela mande preço', async () => {
        const reply = fakeReply()
        await createComplementGroup({
            body: { name: 'Gelo e limão', quick_note: true, options: [{ name: 'Sem gelo', price: 2 }, { name: 'Com limão', price: 0.5 }] },
        } as any, reply)
        expect(reply.code).toBe(201)
        expect(estado.criado.quick_note).toBe(true)
        expect(estado.criado.options.create.map((o: any) => o.price)).toEqual([0, 0])
    })

    it('criar sem a marca continua como antes (preço da tela, quick_note false)', async () => {
        const reply = fakeReply()
        await createComplementGroup({ body: { name: 'Adicionais', options: [{ name: 'Bacon', price: 4 }] } } as any, reply)
        expect(estado.criado.quick_note).toBe(false)
        expect(estado.criado.options.create[0].price).toBe(4)
    })

    it('marcar ao editar zera as opções enviadas, as novas e as que a tela não mandou', async () => {
        const reply = fakeReply()
        await updateComplementGroup({
            params: { id: G1 },
            body: { quick_note: true, options: [{ id: 'o1', name: 'Sem cebola', price: 3 }, { name: 'Sem tomate', price: 1 }] },
        } as any, reply)
        expect(reply.code).toBe(200)
        expect(estado.opcoesAtualizadas[0].price).toBe(0)
        expect(estado.opcoesCriadas[0].price).toBe(0)
        expect(estado.zeradas).toEqual([{ where: { group_id: G1, price: { not: 0 } }, data: { price: 0 } }])
        expect(estado.grupoAtualizado.quick_note).toBe(true)
    })

    it('editar sem mandar o campo (tela antiga) mantém a marca do grupo e o preço zero', async () => {
        estado.grupoAtual = { quick_note: true }
        const reply = fakeReply()
        await updateComplementGroup({
            params: { id: G1 },
            body: { name: 'Gelo e limão', options: [{ id: 'o1', name: 'Com gelo', price: 5 }] },
        } as any, reply)
        expect(estado.opcoesAtualizadas[0].price).toBe(0)
        expect(estado.grupoAtualizado.quick_note).toBeUndefined() // não mexe na coluna
        expect(estado.zeradas.length).toBe(1)
    })

    it('grupo comum continua com o preço da tela e nada é zerado', async () => {
        estado.grupoAtual = { quick_note: false }
        const reply = fakeReply()
        await updateComplementGroup({
            params: { id: G1 },
            body: { options: [{ id: 'o1', name: 'Bacon', price: 4 }] },
        } as any, reply)
        expect(estado.opcoesAtualizadas[0].price).toBe(4)
        expect(estado.zeradas).toEqual([])
    })
})
