import { beforeEach, describe, expect, it, vi } from 'vitest'

// Mergulho (07:S5): código do Athos que já é de outro produto na nuvem. Banco de mentira (nada é gravado de verdade).
const db: any = vi.hoisted(() => ({}))
vi.mock('@/lib/prisma', () => ({ prisma: db }))

import { postProductsBulkSync } from './pdv-sync-controller'

function resposta() {
    const r: any = { code: 0, body: null }
    r.status = (c: number) => { r.code = c; return r }
    r.send = (b: any) => { r.body = b; return r }
    return r
}

let produtos: any[] = []
let vendidos = new Set<string>()

function montarBanco() {
    db.category = { findUnique: vi.fn(async () => null), create: vi.fn(async () => ({ id: 'cat' })) }
    db.subcategory = { findFirst: vi.fn(async () => null), create: vi.fn(async () => ({ id: 'sub' })) }
    db.saleItem = { count: vi.fn(async ({ where }: any) => (vendidos.has(where.product_id) ? 3 : 0)) }
    db.pedidoItem = { count: vi.fn(async () => 0) }
    db.product = {
        aggregate: vi.fn(async ({ where }: any) => {
            const lista = where?.display_id?.lt ? produtos.filter((p) => p.display_id < where.display_id.lt) : produtos
            return { _max: { display_id: lista.length ? Math.max(...lista.map((p) => p.display_id)) : null } }
        }),
        findFirst: vi.fn(async ({ where }: any) => {
            const nome = where.OR[0].name.equals.toLowerCase()
            return produtos.find((p) => p.name.toLowerCase() === nome) || null
        }),
        findUnique: vi.fn(async ({ where }: any) => produtos.find((p) => p.display_id === where.display_id) || null),
        update: vi.fn(async ({ where, data }: any) => {
            const p = produtos.find((x) => x.id === where.id)
            Object.assign(p, data)
            return p
        }),
        create: vi.fn(async ({ data }: any) => {
            const p = { id: `novo-${produtos.length}`, ...data }
            produtos.push(p)
            return p
        }),
    }
}

function produto(id: string, name: string, display_id: number) {
    return { id, name, display_id, price: 10, cost: 0, stock: 0, active: true, category_id: 'cat', barcode: null, description: null }
}

async function sincronizar(lista: any[]) {
    const r = resposta()
    await postProductsBulkSync({ body: { products: lista }, log: { warn: vi.fn() } } as any, r)
    return r
}

describe('código do Athos já usado por outro produto na nuvem (Mergulho 07:S5)', () => {
    beforeEach(() => {
        for (const k of Object.keys(db)) delete db[k]
        produtos = []
        vendidos = new Set()
        montarBanco()
    })

    it('produto nunca vendido (sobra de importação, como os 148 da Katatau) dá lugar ao código do Athos e é informado', async () => {
        produtos = [produto('pao', 'PAO FRANCES', 5), produto('couve', 'COUVE', 157)]
        const r = await sincronizar([{ name: 'PAO FRANCES', displayId: 157, price: 10 }])
        expect(produtos.find((p) => p.id === 'pao')!.display_id).toBe(157)
        expect(produtos.find((p) => p.id === 'couve')!.display_id).toBe(900001)
        expect(r.body.renumerados).toEqual([{ produto: 'COUVE', de: 157, para: 900001 }])
        expect(r.body.conflitos).toEqual([])
    })

    it('produto com venda fica com o código; o do Athos também não muda, e o conflito volta na resposta', async () => {
        produtos = [produto('pao', 'PAO FRANCES', 5), produto('couve', 'COUVE', 157)]
        vendidos.add('couve')
        const r = await sincronizar([{ name: 'PAO FRANCES', displayId: 157, price: 10 }])
        expect(produtos.find((p) => p.id === 'couve')!.display_id).toBe(157)
        expect(produtos.find((p) => p.id === 'pao')!.display_id).toBe(5)
        expect(r.body.conflitos).toEqual([{ codigo: 157, produtoNaNuvem: 'COUVE', produtoDoAthos: 'PAO FRANCES', codigoQueFicou: 5 }])
        expect(r.body.message).toContain('157 (COUVE x PAO FRANCES)')
    })

    it('produto novo do Athos com código de produto em uso ganha um código livre fora da faixa 900.000', async () => {
        produtos = [produto('leite', 'LEITE', 200), produto('velho', 'SOBRA', 900005)]
        vendidos.add('leite')
        const r = await sincronizar([{ name: 'QUEIJO', displayId: 200, price: 30 }])
        const queijo = produtos.find((p) => p.name === 'QUEIJO')!
        expect(queijo.display_id).toBe(201)
        expect(produtos.find((p) => p.id === 'leite')!.display_id).toBe(200)
        expect(r.body.conflitos[0]).toMatchObject({ codigo: 200, codigoQueFicou: 201 })
    })

    it('código livre: produto novo entra com o código do Athos, sem conflito', async () => {
        produtos = [produto('leite', 'LEITE', 200)]
        const r = await sincronizar([{ name: 'QUEIJO', displayId: 300, price: 30 }])
        expect(produtos.find((p) => p.name === 'QUEIJO')!.display_id).toBe(300)
        expect(r.body).toMatchObject({ created: 1, conflitos: [], renumerados: [] })
    })
})
