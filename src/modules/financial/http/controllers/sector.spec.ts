import { describe, it, expect, vi, beforeEach } from 'vitest'

// Fase 4 do Mergulho (17:U9): renomear e excluir o setor (categoria) do financeiro.
const estado: any = {}
vi.mock('@/lib/prisma', () => ({
    prisma: {
        sector: {
            findUnique: async ({ where }: any) => (estado.setores.includes(where.id) ? { id: where.id } : null),
            update: async ({ where, data }: any) => { estado.atualizado = { id: where.id, ...data }; return estado.atualizado },
            delete: async ({ where }: any) => { estado.apagado = where.id },
        },
        transaction: { count: async () => estado.lancamentos },
        cashierEntry: { count: async () => 0 },
    },
}))

import { updateSector, deleteSector } from './sector'

const ID = '11111111-1111-1111-1111-111111111111'

function fakeReply() {
    const r: any = { code: 0, body: null }
    r.status = (c: number) => { r.code = c; return r }
    r.send = (b?: any) => { r.body = b; return r }
    return r
}

beforeEach(() => {
    estado.setores = [ID]
    estado.lancamentos = 0
    estado.atualizado = null
    estado.apagado = null
})

describe('Setores (17:U9)', () => {
    it('renomeia o setor', async () => {
        const reply = fakeReply()
        await updateSector({ params: { id: ID }, body: { name: 'Hortifruti' } } as any, reply)
        expect(reply.code).toBe(200)
        expect(estado.atualizado).toMatchObject({ id: ID, name: 'Hortifruti' })
    })

    it('exclui o setor sem lançamentos', async () => {
        const reply = fakeReply()
        await deleteSector({ params: { id: ID } } as any, reply)
        expect(reply.code).toBe(204)
        expect(estado.apagado).toBe(ID)
    })

    it('não exclui setor com lançamentos (sugere renomear)', async () => {
        estado.lancamentos = 3
        const reply = fakeReply()
        await deleteSector({ params: { id: ID } } as any, reply)
        expect(reply.code).toBe(409)
        expect(reply.body.message).toContain('Renomeie')
        expect(estado.apagado).toBeNull()
    })

    it('setor inexistente', async () => {
        const reply = fakeReply()
        await updateSector({ params: { id: '22222222-2222-2222-2222-222222222222' }, body: { name: 'X' } } as any, reply)
        expect(reply.code).toBe(404)
    })
})
