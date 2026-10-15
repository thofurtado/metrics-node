import { describe, it, expect, vi, beforeEach } from 'vitest'

// Fase 4 do Mergulho (16:A7 e 16:A8): corrigir e excluir o cadastro do cliente pela web.
const estado: any = {}
vi.mock('@/lib/prisma', () => ({
    prisma: {
        client: {
            findUnique: async ({ where }: any) => estado.clientes.find((c: any) => c.id === where.id) ?? null,
            findMany: async ({ where }: any) => estado.clientes.filter((c: any) =>
                (c.phone || '').includes(where.phone.contains) && c.id !== where.id?.not),
            update: async ({ where, data }: any) => {
                estado.atualizado = { id: where.id, ...data }
                return estado.atualizado
            },
            delete: (args: any) => ({ op: 'delete-client', args }),
        },
        address: { deleteMany: (args: any) => ({ op: 'delete-addresses', args }) },
        treatment: { count: async () => estado.contagens.atendimentos },
        equipment: { count: async () => estado.contagens.equipamentos },
        clientTab: { count: async () => estado.contagens.contas },
        cashierEntry: { count: async () => 0 },
        pedido: { count: async () => 0 },
        $transaction: async (ops: any[]) => { estado.apagou = ops.map(o => o.op) },
    },
}))

import { updateClient, deleteClient } from './update-client'

const ID = '11111111-1111-1111-1111-111111111111'
const OUTRO = '22222222-2222-2222-2222-222222222222'

function fakeReply() {
    const r: any = { code: 0, body: null }
    r.status = (c: number) => { r.code = c; return r }
    r.send = (b?: any) => { r.body = b; return r }
    return r
}

beforeEach(() => {
    estado.clientes = [
        { id: ID, name: 'Maria', phone: '11987654321' },
        { id: OUTRO, name: 'João', phone: '(11) 91234-5678' },
    ]
    estado.contagens = { atendimentos: 0, equipamentos: 0, contas: 0 }
    estado.atualizado = null
    estado.apagou = null
})

describe('PUT /client/:id (16:A7)', () => {
    it('corrige nome e telefone; campo vazio vira "sem"', async () => {
        const reply = fakeReply()
        await updateClient({ params: { id: ID }, body: { name: 'Maria Souza', phone: '11900001111', email: '' } } as any, reply)
        expect(reply.code).toBe(200)
        expect(estado.atualizado).toMatchObject({ name: 'Maria Souza', phone: '11900001111', email: null })
    })

    it('telefone que já é de outro cliente avisa (409) e passa com a confirmação', async () => {
        const r1 = fakeReply()
        await updateClient({ params: { id: ID }, body: { phone: '11 91234-5678' } } as any, r1)
        expect(r1.code).toBe(409)
        expect(r1.body.code).toBe('DUPLICATE_PHONE')
        expect(r1.body.message).toContain('João')

        const r2 = fakeReply()
        await updateClient({ params: { id: ID }, body: { phone: '11 91234-5678', allowDuplicatePhone: true } } as any, r2)
        expect(r2.code).toBe(200)
    })

    it('cliente inexistente', async () => {
        const reply = fakeReply()
        await updateClient({ params: { id: '33333333-3333-3333-3333-333333333333' }, body: { name: 'X' } } as any, reply)
        expect(reply.code).toBe(404)
    })
})

describe('DELETE /client/:id (16:A7)', () => {
    it('exclui o cadastro sem histórico (com os endereços)', async () => {
        const reply = fakeReply()
        await deleteClient({ params: { id: ID } } as any, reply)
        expect(reply.code).toBe(204)
        expect(estado.apagou).toEqual(['delete-addresses', 'delete-client'])
    })

    it('recusa quem tem O.S., equipamento ou conta a prazo', async () => {
        estado.contagens = { atendimentos: 2, equipamentos: 0, contas: 1 }
        const reply = fakeReply()
        await deleteClient({ params: { id: ID } } as any, reply)
        expect(reply.code).toBe(409)
        expect(reply.body.message).toContain('2 atendimento(s)')
        expect(reply.body.message).toContain('1 conta(s) a prazo')
        expect(estado.apagou).toBeNull()
    })
})
