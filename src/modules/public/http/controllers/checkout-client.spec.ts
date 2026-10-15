import { describe, expect, it, vi } from 'vitest'

vi.mock('@fastify/request-context', () => ({
    requestContext: { get: (chave: string) => (globalThis as any).__contexto?.[chave] },
}))

import { checkoutClient } from './checkout-client'
import { getClientByPhone } from './get-client-by-phone'

function bancoFalso(cliente: any) {
    const escritas: string[] = []
    const banco = {
        companyProfile: { findFirst: async () => ({ deliveryFee: 10, deliverySectors: [{ fee: 4, neighborhoods: ['Varadouro'] }, { mode: 'FALLBACK', _type: 'neighborhood_policy' }] }) },
        client: {
            findFirst: async () => cliente,
            create: async ({ data }: any) => { escritas.push('client.create'); return { id: 'novo', name: data.name, phone: data.phone, addresses: [] } },
            update: async ({ data }: any) => { escritas.push('client.update:' + Object.keys(data).join(',')); return {} },
        },
        address: {
            create: async () => { escritas.push('address.create'); return {} },
            update: async () => { escritas.push('address.update'); return {} },
            updateMany: async () => { escritas.push('address.updateMany'); return {} },
        },
    }
    return { banco, escritas }
}

async function chamar(rota: any, banco: any, request: any) {
    ;(globalThis as any).__contexto = { prisma: banco }
    const reply: any = { status: vi.fn().mockReturnThis(), send: vi.fn().mockReturnThis() }
    await rota(request, reply)
    return { status: reply.status.mock.calls[0]?.[0], corpo: reply.send.mock.calls[0]?.[0] }
}

const CLIENTE = {
    id: 'cli-1', name: 'João Dono', phone: '12999990000', identification: '12345678900', email: 'joao@exemplo.com',
    addresses: [{ id: 'end-1', street: 'Rua A', number: '1', neighborhood: 'Varadouro', city: 'Paraty', state: 'RJ', is_main: true, complement: null }],
}

describe('cadastro pelo telefone no cardápio (Mergulho 06:C5)', () => {
    it('quem digita o telefone de outro não troca o nome nem o endereço principal dele', async () => {
        const { banco, escritas } = bancoFalso(CLIENTE)
        const r = await chamar(checkoutClient, banco, { body: { name: 'Outra Pessoa', phone: '12999990000', street: 'Rua B', number: '2', neighborhood: 'Centro', isNewAddress: true } })
        expect(r.status).toBe(200)
        expect(escritas).toEqual([])
    })

    it('nome provisório ("Cliente Delivery") recebe o nome digitado', async () => {
        const { banco, escritas } = bancoFalso({ ...CLIENTE, name: 'Cliente Delivery' })
        await chamar(checkoutClient, banco, { body: { name: 'Maria', phone: '12999990000' } })
        expect(escritas).toEqual(['client.update:name'])
    })

    it('bairro fora dos setores na política FALLBACK é aceito (antes dava 400)', async () => {
        const { banco } = bancoFalso(null)
        const r = await chamar(checkoutClient, banco, { body: { name: 'Maria', phone: '12988887777', street: 'Rua C', number: '3', neighborhood: 'Centro' } })
        expect(r.status).toBe(200)
    })

    it('as rotas públicas devolvem só nome, telefone e endereços (sem documento e e-mail)', async () => {
        const { banco } = bancoFalso(CLIENTE)
        const r = await chamar(getClientByPhone, banco, { params: { phone: '12999990000' } })
        expect(r.status).toBe(200)
        expect(r.corpo.client).toEqual({ name: 'João Dono', phone: '12999990000', addresses: [expect.objectContaining({ id: 'end-1', street: 'Rua A' })] })
        expect(JSON.stringify(r.corpo)).not.toContain('12345678900')
        expect(JSON.stringify(r.corpo)).not.toContain('joao@exemplo.com')
    })
})
