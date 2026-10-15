import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

// Contexto da requisição e aviso ao vivo de mentira (o teste não abre banco nenhum)
vi.mock('@fastify/request-context', () => ({
    requestContext: { get: (chave: string) => (globalThis as any).__contexto?.[chave] },
}))
vi.mock('@/lib/sse-manager', () => ({
    sseManager: { notifyTenant: vi.fn() },
    bancoDaRequisicao: () => 'db_teste',
}))

import { createOnlineOrder } from './create-online-order'

// Cadastro real do Giardinetto (lido em 15/10/2026): pratos, grupo "PONTO DE CARNE" (1 grátis), setores e horários
const PRODUTOS = [
    { id: 'p-porcini', name: 'RISOTTO PORCINI E BIFE ANCHO', price: 139, category_id: 'c1', subcategory: null, complementGroups: [
        { order: 0, group: { id: 'g-ponto', name: 'PONTO DE CARNE', free_quantity: 1, options: [
            { id: 'o-ao-ponto', name: 'AO PONTO', price: 0 }, { id: 'o-mal', name: 'MAL PASSADO', price: 0 },
        ] } },
    ] },
    { id: 'p-parmegiana', name: 'ALLA PARMEGIANA', price: 109, category_id: 'c1', subcategory: null, complementGroups: [] },
]
const PERFIL = {
    isOpenManual: true,
    deliveryFee: 50,
    minOrderValue: 44,
    deliverySectors: [
        { id: 's1', fee: 9, name: 'Setor 1', neighborhoods: ['Massaguaçú', 'Balneário Copacabana'] },
        { id: 's2', fee: 14, name: 'Setor 2', neighborhoods: ['Jardim Olaria'] },
        { mode: 'STRICT', _type: 'neighborhood_policy' },
    ],
    businessHours: [
        { dayOfWeek: 2, openTime: '12:00', closeTime: '16:00', isOpen: true },
        { dayOfWeek: 2, openTime: '18:00', closeTime: '21:30', isOpen: true },
    ],
}

function bancoFalso(opcoes: { clientes?: any[]; pedidos?: any[]; perfil?: any } = {}) {
    const pedidos: any[] = opcoes.pedidos || []
    const registro = { pedidosCriados: [] as any[], clientesAlterados: [] as any[], enderecosCriados: [] as any[] }
    const banco = {
        pedido: {
            findFirst: async ({ where }: any) => pedidos.find((p) => p.uuid === where.uuid) || null,
            findMany: async ({ where }: any) => pedidos.filter((p) => p.cliente_id === where.cliente_id && p.valor_final === where.valor_final),
            count: async () => pedidos.length,
            create: async ({ data }: any) => {
                const p = { ...data, uuid: data.uuid || `ped-${pedidos.length + 1}`, data_abertura: new Date(), itens: data.itens.create.map((i: any, k: number) => ({ ...i, uuid: `it-${k}` })) }
                pedidos.push(p)
                registro.pedidosCriados.push(p)
                return p
            },
        },
        companyProfile: { findFirst: async () => (opcoes.perfil === undefined ? PERFIL : opcoes.perfil) },
        product: { findMany: async () => PRODUTOS },
        client: {
            findFirst: async () => (opcoes.clientes || [])[0] || null,
            create: async ({ data }: any) => ({ id: 'cli-novo', name: data.name, phone: data.phone, addresses: data.addresses ? [{ id: 'end-novo', ...data.addresses.create }] : [] }),
            update: async ({ data }: any) => { registro.clientesAlterados.push(data); return {} },
        },
        address: {
            create: async ({ data }: any) => { const a = { id: `end-${registro.enderecosCriados.length + 1}`, ...data }; registro.enderecosCriados.push(a); return a },
        },
        cashierSession: { findFirst: async () => null },
    }
    return { banco, registro }
}

function pedidoDoCardapio(extra: Record<string, unknown> = {}) {
    return {
        client_name: 'Maria Teste',
        client_phone: '(12) 99999-0000',
        origin: 'Delivery',
        street: 'Rua das Flores',
        number: '10',
        neighborhood: 'Massaguaçú',
        city: 'Caraguatatuba',
        state: 'SP',
        payment_method_name: 'PIX',
        delivery_fee: 9,
        total_amount: 148,
        notes: 'Entrega (Delivery)',
        items: [{ product_id: 'p-porcini', name: 'RISOTTO PORCINI E BIFE ANCHO', quantity: 1, unit_price: 139, complements: [{ name: 'AO PONTO', price: 0, quantity: 1 }] }],
        ...extra,
    }
}

async function enviar(banco: any, corpo: any, url = '/public/orders') {
    ;(globalThis as any).__contexto = { prisma: banco, tenant: 'db_teste' }
    const request: any = { url, body: corpo, log: { warn: vi.fn() } }
    const reply: any = { status: vi.fn().mockReturnThis(), send: vi.fn().mockReturnThis() }
    await createOnlineOrder(request, reply)
    return { status: reply.status.mock.calls[0]?.[0], corpo: reply.send.mock.calls[0]?.[0], log: request.log.warn }
}

describe('pedido do cardápio conferido pela nuvem (Mergulho 06:C4, C5, C6, C2, C8)', () => {
    beforeEach(() => {
        vi.useFakeTimers({ toFake: ['Date'] })
        vi.setSystemTime(new Date('2026-10-13T22:00:00Z')) // terça 19:00 de Brasília: Giardinetto aberto
    })
    afterEach(() => {
        vi.useRealTimers()
    })

    it('pedido certo entra com o preço do cadastro, a taxa do setor e o total conferido', async () => {
        const { banco, registro } = bancoFalso()
        const r = await enviar(banco, pedidoDoCardapio())
        expect(r.status).toBe(201)
        const p = registro.pedidosCriados[0]
        expect(p).toMatchObject({ subtotal: 139, valor_frete: 9, valor_final: 148, status: 'Aberto', status_delivery: 'Pendente' })
        expect(p.itens[0]).toMatchObject({ produto_id: 'p-porcini', valor_unitario: 139, valor_total: 139 })
        expect(JSON.parse(p.itens[0].complementos_json)[0]).toMatchObject({ name: 'AO PONTO', price: 0, quantity: 1 })
    })

    it('preço mexido no navegador (R$ 139 por R$ 1): registra no log, recusa com 409 e devolve os valores certos', async () => {
        const { banco, registro } = bancoFalso()
        const corpo = pedidoDoCardapio({ total_amount: 10, items: [{ product_id: 'p-porcini', quantity: 1, unit_price: 1, complements: [{ name: 'AO PONTO', price: 0, quantity: 1 }] }] })
        const r = await enviar(banco, corpo)
        expect(r.status).toBe(409)
        expect(r.corpo).toMatchObject({ code: 'PRECO_DIVERGENTE', total_amount: 148, delivery_fee: 9 })
        expect(r.corpo.itens[0]).toMatchObject({ index: 0, unit_price: 139 })
        expect(r.log).toHaveBeenCalled()
        expect(registro.pedidosCriados).toHaveLength(0)
    })

    it('com os valores devolvidos pela nuvem, o reenvio entra (o cliente legítimo nunca fica travado)', async () => {
        const { banco } = bancoFalso()
        const recusa = await enviar(banco, pedidoDoCardapio({ total_amount: 150, items: [{ product_id: 'p-porcini', quantity: 1, unit_price: 141, complements: [{ name: 'AO PONTO', price: 0, quantity: 1 }] }] }))
        expect(recusa.status).toBe(409)
        const reenvio = pedidoDoCardapio({ total_amount: recusa.corpo.total_amount, delivery_fee: recusa.corpo.delivery_fee, items: [{ product_id: 'p-porcini', quantity: 1, unit_price: recusa.corpo.itens[0].unit_price, complements: [{ name: 'AO PONTO', price: 0, quantity: 1 }] }] })
        expect((await enviar(banco, reenvio)).status).toBe(201)
    })

    it('o PDV (rota /api/pdv/orders, origem PDV) continua gravando o que o caixa mandou', async () => {
        const { banco, registro } = bancoFalso()
        const corpo = { uuid: '3f1c2b9e-1d2c-4b5a-9e8f-7a6b5c4d3e2f', display_id: 7, origin: 'PDV', client_name: 'Cliente Delivery', client_phone: '00000000000', street: 'Rua A', number: '1', neighborhood: 'Centro', delivery_fee: 5, total_amount: 55, items: [{ product_id: 'p-parmegiana-uuid-longo', quantity: 1, unit_price: 50 }] }
        vi.setSystemTime(new Date('2026-10-13T06:00:00Z')) // madrugada: o PDV não depende do horário do cardápio
        const r = await enviar(banco, corpo, '/api/pdv/orders')
        expect(r.status).toBe(201)
        expect(registro.pedidosCriados[0]).toMatchObject({ valor_final: 55, valor_frete: 5, display_id: 7 })
        expect(registro.pedidosCriados[0].itens[0]).toMatchObject({ valor_unitario: 50 })
    })

    it('origem "PDV" mandada na rota do cardápio não pula a conferência', async () => {
        const { banco } = bancoFalso()
        const r = await enviar(banco, pedidoDoCardapio({ origin: 'PDV', total_amount: 10, items: [{ product_id: 'p-parmegiana', quantity: 1, unit_price: 1 }] }))
        expect(r.status).toBe(409)
    })

    it('loja fechada (terça 03:00): 409 LOJA_FECHADA e nada gravado', async () => {
        vi.setSystemTime(new Date('2026-10-13T06:00:00Z'))
        const { banco, registro } = bancoFalso()
        const r = await enviar(banco, pedidoDoCardapio())
        expect(r.status).toBe(409)
        expect(r.corpo.code).toBe('LOJA_FECHADA')
        expect(registro.pedidosCriados).toHaveLength(0)
    })

    it('sem WhatsApp com DDD (06:C2): 400 com mensagem clara', async () => {
        const { banco } = bancoFalso()
        expect((await enviar(banco, pedidoDoCardapio({ client_phone: '' }))).status).toBe(400)
        expect((await enviar(banco, pedidoDoCardapio({ client_name: '  ' }))).status).toBe(400)
    })

    it('bairro fora da área em STRICT: mesma mensagem de antes (o cardápio leva ao WhatsApp)', async () => {
        const { banco } = bancoFalso()
        const r = await enviar(banco, pedidoDoCardapio({ neighborhood: 'Centro', delivery_fee: 50, total_amount: 189 }))
        expect(r.status).toBe(400)
        expect(r.corpo.message).toContain('área de entrega')
    })

    it('telefone de outra pessoa (06:C5): não troca o nome do cadastro nem mexe no endereço dela; o nome vai na observação', async () => {
        const existente = { id: 'cli-1', name: 'João Dono', phone: '12999990000', addresses: [{ id: 'end-joao', street: 'Rua das Flores', number: '10', neighborhood: 'Massaguaçú', complement: 'Casa 2', city: 'Caraguatatuba', state: 'SP', is_main: true }] }
        const { banco, registro } = bancoFalso({ clientes: [existente] })
        const r = await enviar(banco, pedidoDoCardapio({ complement: 'Fundos' }))
        expect(r.status).toBe(201)
        expect(registro.clientesAlterados.some((d) => 'name' in d)).toBe(false)
        expect(registro.enderecosCriados[0]).toMatchObject({ complement: 'Fundos', is_main: false })
        expect(registro.pedidosCriados[0].endereco_entrega_id).toBe(registro.enderecosCriados[0].id)
        expect(registro.pedidosCriados[0].observacao).toContain('Nome no pedido: Maria Teste')
    })

    it('cadastro com nome provisório ("Cliente Delivery") ganha o nome digitado', async () => {
        const existente = { id: 'cli-1', name: 'Cliente Delivery', phone: '12999990000', addresses: [] }
        const { banco, registro } = bancoFalso({ clientes: [existente] })
        expect((await enviar(banco, pedidoDoCardapio())).status).toBe(201)
        expect(registro.clientesAlterados[0]).toMatchObject({ name: 'Maria Teste' })
    })

    it('trava de 2 min (06:C8): sem uuid, mesmo valor mas outro endereço não é repetido; mesmo pedido é', async () => {
        const existente = { id: 'cli-1', name: 'Maria Teste', phone: '12999990000', addresses: [{ id: 'end-maria', street: 'Rua das Flores', number: '10', neighborhood: 'Massaguaçú', complement: null, city: 'Caraguatatuba', state: 'SP' }] }
        const { banco, registro } = bancoFalso({ clientes: [existente] })
        expect((await enviar(banco, pedidoDoCardapio())).status).toBe(201)
        expect((await enviar(banco, pedidoDoCardapio())).status).toBe(200) // toque duplo: devolve o mesmo
        expect((await enviar(banco, pedidoDoCardapio({ street: 'Rua do Colega', number: '99' }))).status).toBe(201)
        expect(registro.pedidosCriados).toHaveLength(2)
    })

    it('com uuid (cardápio novo): dois pedidos iguais de verdade entram os dois; o reenvio do mesmo uuid não duplica', async () => {
        const existente = { id: 'cli-1', name: 'Maria Teste', phone: '12999990000', addresses: [] }
        const { banco, registro } = bancoFalso({ clientes: [existente] })
        expect((await enviar(banco, pedidoDoCardapio({ uuid: '11111111-1111-4111-8111-111111111111' }))).status).toBe(201)
        expect((await enviar(banco, pedidoDoCardapio({ uuid: '11111111-1111-4111-8111-111111111111' }))).status).toBe(200)
        expect((await enviar(banco, pedidoDoCardapio({ uuid: '22222222-2222-4222-8222-222222222222' }))).status).toBe(201)
        expect(registro.pedidosCriados).toHaveLength(2)
    })

    it('o cardápio não escolhe número nem situação do pedido', async () => {
        const { banco, registro } = bancoFalso()
        await enviar(banco, pedidoDoCardapio({ display_id: 999, status: 'Fechado', status_delivery: 'delivered' }))
        expect(registro.pedidosCriados[0]).toMatchObject({ display_id: 1, status: 'Aberto', status_delivery: 'Pendente' })
    })
})
