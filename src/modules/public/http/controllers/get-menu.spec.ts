import { beforeEach, describe, expect, it, vi } from 'vitest'

// Observação rápida (só no salão), 16/10/2026: o grupo marcado nunca sai no cardápio online; o PDV (com a chave) recebe o
// grupo com "observacaoRapida": true e as opções com preço zero.
const CHAVE = 'chave-do-teste'
process.env.PDV_API_KEY = CHAVE

const GRUPOS = [
    { id: 'g-ponto', name: 'Ponto da carne', min_quantity: 1, max_quantity: 1, free_quantity: 0, active: true, quick_note: false,
      options: [{ id: 'o-mal', name: 'Mal passada', price: 0 }], products: [{ product_id: 'p-burger', order: 0 }] },
    { id: 'g-gelo', name: 'Gelo e limão', min_quantity: 0, max_quantity: 5, free_quantity: 0, active: true, quick_note: true,
      // Preço sobrando de antes da marca: mesmo assim sai zero
      options: [{ id: 'o-sem-gelo', name: 'Sem gelo', price: 1.5 }, { id: 'o-limao', name: 'Com limão', price: 0 }],
      products: [{ product_id: 'p-coca', order: 0 }] },
]
const LIGACOES: Record<string, string[]> = { 'p-burger': ['g-ponto'], 'p-coca': ['g-gelo'] }

const estado = { semColuna: false, chamadas: 0 }

/** O que o Prisma faria com o where e o select do grupo (só o que a rota usa). */
function grupoPassa(g: any, where: any): boolean {
    if (!where) return true
    if (where.active !== undefined && g.active !== where.active) return false
    if (where.quick_note !== undefined && g.quick_note !== where.quick_note) return false
    return true
}
function selecionar(g: any, select: any) {
    if (estado.semColuna && select.quick_note) throw Object.assign(new Error('The column `complement_groups.quick_note` does not exist in the current database.'), { code: 'P2022', meta: { column: 'complement_groups.quick_note' } })
    const saida: any = { id: g.id, name: g.name, min_quantity: g.min_quantity, max_quantity: g.max_quantity, free_quantity: g.free_quantity, options: g.options }
    if (select.quick_note) saida.quick_note = g.quick_note
    if (select.products) saida.products = g.products
    return saida
}

const prismaFalso = {
    product: {
        findMany: async ({ select }: any) => {
            estado.chamadas++
            const cg = select.complementGroups
            return ['p-burger', 'p-coca'].map((id) => ({
                id, display_id: 1, name: id, price: 10, description: null, measureUnit: 'UN', image_url: null, is_priority: false,
                category: { id: 'c', name: 'Geral' }, subcategory: null,
                complementGroups: LIGACOES[id]
                    .map((gid) => GRUPOS.find((g) => g.id === gid)!)
                    .filter((g) => grupoPassa(g, cg.where?.group))
                    .map((g, order) => ({ order, group: selecionar(g, cg.select.group.select) })),
            }))
        },
    },
    payment: { findMany: async () => [] },
    complementGroup: {
        findMany: async ({ where, select }: any) => GRUPOS.filter((g) => grupoPassa(g, where)).map((g) => selecionar(g, select)),
    },
    subcategory: { findMany: async () => [] },
}

vi.mock('@fastify/request-context', () => ({ requestContext: { get: (k: string) => (k === 'prisma' ? prismaFalso : undefined) } }))

import { getMenu } from './get-menu'

async function pedirCardapio(headers: Record<string, string> = {}) {
    const resposta: any = {}
    const reply: any = {
        status: (c: number) => { resposta.status = c; return reply },
        send: (b: any) => { resposta.body = b; return reply },
    }
    const request: any = { headers, log: { warn: vi.fn(), error: vi.fn() } }
    await getMenu(request, reply)
    return resposta
}

const nomesDosGrupos = (body: any) => ({
    noProduto: body.products.flatMap((p: any) => p.complementGroups.map((g: any) => g.name)),
    naLista: body.complementGroups.map((g: any) => g.name),
})

beforeEach(() => { estado.semColuna = false; estado.chamadas = 0 })

describe('GET /public/menu: observação rápida (só no salão)', () => {
    it('cardápio online (sem chave): o grupo marcado não aparece no produto nem na lista', async () => {
        const r = await pedirCardapio()
        expect(r.status).toBe(200)
        expect(nomesDosGrupos(r.body)).toEqual({ noProduto: ['Ponto da carne'], naLista: ['Ponto da carne'] })
        expect(JSON.stringify(r.body)).not.toContain('Gelo e limão')
        expect(JSON.stringify(r.body)).not.toContain('Sem gelo')
    })

    it('chave errada é o cardápio online', async () => {
        const r = await pedirCardapio({ 'x-api-key': 'outra' })
        expect(JSON.stringify(r.body)).not.toContain('Gelo e limão')
    })

    it('PDV (com a chave): recebe o grupo com observacaoRapida true e as opções com preço zero', async () => {
        const r = await pedirCardapio({ 'x-api-key': CHAVE })
        expect(nomesDosGrupos(r.body)).toEqual({ noProduto: ['Ponto da carne', 'Gelo e limão'], naLista: ['Ponto da carne', 'Gelo e limão'] })
        const gelo = r.body.complementGroups.find((g: any) => g.id === 'g-gelo')
        expect(gelo.observacaoRapida).toBe(true)
        expect(gelo.options.map((o: any) => o.price)).toEqual([0, 0])
        expect(gelo.products).toEqual([{ product_id: 'p-coca', order: 0 }])
        const naCoca = r.body.products.find((p: any) => p.id === 'p-coca').complementGroups[0]
        expect(naCoca).toMatchObject({ id: 'g-gelo', observacaoRapida: true })
        expect(naCoca.options[0].price).toBe(0)
        expect(r.body.complementGroups.find((g: any) => g.id === 'g-ponto').observacaoRapida).toBe(false)
    })

    it('banco sem a coluna (antes do Sincronizar): o cardápio sai como antes, sem nada marcado', async () => {
        estado.semColuna = true
        const r = await pedirCardapio()
        expect(r.status).toBe(200)
        expect(estado.chamadas).toBe(2) // tentou com a coluna e refez sem ela
        expect(r.body.complementGroups.every((g: any) => g.observacaoRapida === false)).toBe(true)
    })
})
