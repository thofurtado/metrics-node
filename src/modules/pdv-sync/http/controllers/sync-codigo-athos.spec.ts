import { beforeEach, describe, expect, it, vi } from 'vitest'

// O código do Athos manda (16/10/2026, Katatau). Banco de mentira: nada é gravado de verdade.
const db: any = vi.hoisted(() => ({}))
vi.mock('@/lib/prisma', () => ({ prisma: db }))

import { postProductsBulkSync, postProductsEspelhoSync } from './pdv-sync-controller'
import { mesmoProduto, planoDoEspelho } from '../../services/codigo-do-sistema-da-loja'

function resposta() {
    const r: any = { code: 0, body: null }
    r.status = (c: number) => { r.code = c; return r }
    r.send = (b: any) => { r.body = b; return r }
    return r
}

let produtos: any[] = []
let vendidos = new Set<string>()
let vinculados = new Set<string>()

function montarBanco() {
    db.category = { findUnique: vi.fn(async () => null), create: vi.fn(async () => ({ id: 'cat' })) }
    db.subcategory = { findFirst: vi.fn(async () => null), create: vi.fn(async () => ({ id: 'sub' })) }
    db.saleItem = { count: vi.fn(async ({ where }: any) => (vendidos.has(where.product_id) ? 3 : 0)) }
    db.pedidoItem = { count: vi.fn(async () => 0) }
    db.deliveryItemMapping = { count: vi.fn(async ({ where }: any) => (vinculados.has(where.product_id) ? 1 : 0)) }
    db.product = {
        aggregate: vi.fn(async () => ({ _max: { display_id: produtos.length ? Math.max(...produtos.map((p) => p.display_id)) : null } })),
        findFirst: vi.fn(async ({ where }: any) => {
            const nome = where.OR[0].name.equals.toLowerCase()
            const barras = where.OR[1]?.barcode
            return produtos.find((p) => p.name.toLowerCase() === nome || (barras && p.barcode === barras)) || null
        }),
        findUnique: vi.fn(async ({ where }: any) => produtos.find((p) => p.display_id === where.display_id) || null),
        findMany: vi.fn(async () => produtos.map((p) => ({ id: p.id, display_id: p.display_id, name: p.name, active: p.active }))),
        update: vi.fn(async ({ where, data }: any) => {
            const p = produtos.find((x) => x.id === where.id)
            Object.assign(p, data)
            return p
        }),
        updateMany: vi.fn(async ({ where, data }: any) => {
            const alvo = produtos.filter((p) => where.id.in.includes(p.id))
            alvo.forEach((p) => Object.assign(p, data))
            return { count: alvo.length }
        }),
        create: vi.fn(async ({ data }: any) => {
            const p = { id: `novo-${produtos.length}`, ...data }
            produtos.push(p)
            return p
        }),
    }
}

function produto(id: string, name: string, display_id: number, extra: any = {}) {
    return { id, name, display_id, price: 10, cost: 0, stock: 0, active: true, category_id: 'cat', barcode: null, description: null, ...extra }
}

const achar = (id: string) => produtos.find((p) => p.id === id)!
const noCodigo = (codigo: number) => produtos.find((p) => p.display_id === codigo)

async function sincronizar(lista: any[], extra: any = {}) {
    const r = resposta()
    await postProductsBulkSync({ body: { products: lista, ...extra }, log: { warn: vi.fn() } } as any, r)
    return r
}

async function espelhar(lista: { codigo: number; ativo: boolean }[], simular?: boolean) {
    const r = resposta()
    await postProductsEspelhoSync({ body: { produtos: lista, simular }, log: { warn: vi.fn() } } as any, r)
    return r
}

beforeEach(() => {
    for (const k of Object.keys(db)) delete db[k]
    produtos = []
    vendidos = new Set()
    vinculados = new Set()
    montarBanco()
})

describe('o código do Athos manda (envio em lote com displayId)', () => {
    it('o produto é o do código, não o de mesmo nome: o 137 vira o Chocolate e a cópia não é tocada', async () => {
        produtos = [produto('copia', 'CHOCOLATE EM PO NEILAR 200G', 900010), produto('alvejante', 'ALVEJANTE SAIF 500ML TIRA MANCHAS', 137)]
        const r = await sincronizar([{ name: 'CHOCOLATE EM PO NEILAR 200G', displayId: 137, price: 8.5 }])
        expect(achar('alvejante')).toMatchObject({ display_id: 137, name: 'CHOCOLATE EM PO NEILAR 200G', price: 8.5 })
        expect(achar('copia')).toMatchObject({ display_id: 900010, name: 'CHOCOLATE EM PO NEILAR 200G', active: true })
        expect(r.body).toMatchObject({ created: 0, updated: 1 })
        expect(r.body.renomeados).toEqual([{ codigo: 137, de: 'ALVEJANTE SAIF 500ML TIRA MANCHAS', para: 'CHOCOLATE EM PO NEILAR 200G', outroProduto: true }])
        expect(r.body.substituidos).toEqual([])
    })

    it('outro produto no código (nunca usado) recebe os dados do Athos e não herda nada do produto errado', async () => {
        produtos = [produto('alvejante', 'ALVEJANTE SAIF', 137, {
            barcode: '7896000000017', csosn: '102', cfop: '5102', image_url: '/img/alvejante.jpg', stock: 50, description: 'limpeza', ncm: '28289011',
        })]
        await sincronizar([{ name: 'CHOCOLATE EM PO NEILAR 200G', displayId: 137, price: 8, csosn: '500', cfop: '5102', ncm: '18061000', stock: 3 }])
        expect(achar('alvejante')).toMatchObject({
            name: 'CHOCOLATE EM PO NEILAR 200G', barcode: null, csosn: '500', cfop: '5405', ncm: '18061000', image_url: null, stock: 3, description: null,
        })
    })

    it('o mesmo produto com o nome completado no Athos só é renomeado: CSOSN/CFOP e saldo da nuvem ficam', async () => {
        produtos = [produto('rodo', 'RODO PASSA CERA MJ', 41, { csosn: '102', cfop: '5102', stock: 7, barcode: '7891112223334' })]
        const r = await sincronizar([{ name: 'RODO PASSA CERA MJ 30CM', displayId: 41, price: 14.99, csosn: '500', cfop: '5405', stock: 99 }])
        expect(achar('rodo')).toMatchObject({ name: 'RODO PASSA CERA MJ 30CM', price: 14.99, csosn: '102', cfop: '5102', stock: 7, barcode: '7891112223334' })
        expect(r.body.renomeados).toEqual([{ codigo: 41, de: 'RODO PASSA CERA MJ', para: 'RODO PASSA CERA MJ 30CM', outroProduto: false }])
    })

    it('código livre: cria com o código do Athos, mesmo com produto de mesmo nome em outro código (sem renumerar nada)', async () => {
        produtos = [produto('copia', 'QUEIJO', 900003)]
        const r = await sincronizar([{ name: 'QUEIJO', displayId: 300, price: 30, stock: 4 }])
        expect(noCodigo(300)).toMatchObject({ name: 'QUEIJO', price: 30, stock: 4 })
        expect(achar('copia').display_id).toBe(900003)
        expect(r.body).toMatchObject({ created: 1, updated: 0, renomeados: [], substituidos: [] })
    })

    it('produto JÁ VENDIDO com o nome de outro produto: o antigo sai do código (inativo, com o histórico) e nasce um novo', async () => {
        produtos = [produto('cafe', 'CAFE PEQUENO PRETO', 2165, { price: 3 }), produto('sobra', 'SOBRA', 900005, { active: false })]
        vendidos.add('cafe')
        const r = await sincronizar([{ name: 'PO DE CAFE UNIAO EXTRAFORTE 500 G', displayId: 2165, price: 21.9 }])
        expect(achar('cafe')).toMatchObject({ name: 'CAFE PEQUENO PRETO', display_id: 900006, active: false, price: 3 })
        expect(noCodigo(2165)).toMatchObject({ name: 'PO DE CAFE UNIAO EXTRAFORTE 500 G', price: 21.9, active: true })
        expect(noCodigo(2165).id).not.toBe('cafe')
        expect(r.body.substituidos).toEqual([{ codigo: 2165, produtoAntigo: 'CAFE PEQUENO PRETO', codigoDoAntigo: 900006, produtoNovo: 'PO DE CAFE UNIAO EXTRAFORTE 500 G' }])
        expect(r.body).toMatchObject({ created: 1, updated: 0 })
    })

    it('produto já vendido que só teve o nome corrigido continua o mesmo produto, no mesmo código', async () => {
        produtos = [produto('rodo', 'RODO PASSA CERA MJ', 41)]
        vendidos.add('rodo')
        const r = await sincronizar([{ name: 'RODO PASSA CERA MJ 30CM', displayId: 41, price: 10 }])
        expect(achar('rodo')).toMatchObject({ display_id: 41, name: 'RODO PASSA CERA MJ 30CM', active: true })
        expect(r.body).toMatchObject({ created: 0, updated: 1, substituidos: [] })
    })

    it('produto JÁ VENDIDO com o código de barras do Athos mas outro nome (o 3022 da Katatau) também sai do código: o nome decide o histórico', async () => {
        produtos = [produto('mousse', 'MOUSSE GRANDE UNID', 3022, { barcode: '7896423456431', price: 16 })]
        vendidos.add('mousse')
        const r = await sincronizar([{ name: 'SNICKERS MOUSSE DE MARACUJA 42G', displayId: 3022, price: 6, barcode: '7896423456431' }])
        expect(achar('mousse')).toMatchObject({ name: 'MOUSSE GRANDE UNID', active: false, display_id: 900001, price: 16 })
        expect(noCodigo(3022)).toMatchObject({ name: 'SNICKERS MOUSSE DE MARACUJA 42G', barcode: '7896423456431', active: true })
        expect(r.body.substituidos).toHaveLength(1)
    })

    it('nunca usado, mesmo código de barras e outro tamanho no nome: o mesmo cadastro (fica o CSOSN/CFOP revisado)', async () => {
        produtos = [produto('sabao', 'SABAO ASSIM NEUTRO 800 G', 2516, { barcode: '7896000025161', csosn: '102', cfop: '5102', stock: 4 })]
        const r = await sincronizar([{ name: 'SABAO ASSIM NEUTRO 900 G', displayId: 2516, price: 5, barcode: '7896000025161', csosn: '500', cfop: '5405', stock: 40 }])
        expect(achar('sabao')).toMatchObject({ name: 'SABAO ASSIM NEUTRO 900 G', csosn: '102', cfop: '5102', stock: 4 })
        expect(r.body.renomeados[0]).toMatchObject({ codigo: 2516, outroProduto: false })
    })

    it('vínculo com item do iFood/99 conta como uso (o vínculo fica com o produto antigo)', async () => {
        produtos = [produto('mousse', 'MOUSSE GRANDE UNID', 3022)]
        vinculados.add('mousse')
        const r = await sincronizar([{ name: 'SNICKERS MOUSSE DE MARACUJA 42G', displayId: 3022, price: 6 }])
        expect(achar('mousse')).toMatchObject({ active: false, display_id: 900001 })
        expect(noCodigo(3022).name).toBe('SNICKERS MOUSSE DE MARACUJA 42G')
        expect(r.body.substituidos).toHaveLength(1)
    })

    it('sem código (outros sistemas): acha pelo nome, como antes, e não mexe no código', async () => {
        produtos = [produto('leite', 'LEITE', 200)]
        const r = await sincronizar([{ name: 'leite', price: 5 }])
        expect(achar('leite')).toMatchObject({ display_id: 200, price: 5 })
        expect(r.body).toMatchObject({ created: 0, updated: 1 })
    })
})

describe('estoque do sistema da loja (a loja vende pelo Metrics desde 16/10/2026)', () => {
    it('produto que já existe: o estoque do Athos não sobrescreve o saldo da nuvem nem conta como mudança', async () => {
        produtos = [produto('pao', 'PAO FRANCES', 5, { stock: 10 })]
        const r = await sincronizar([{ name: 'PAO FRANCES', displayId: 5, price: 10, stock: 50 }])
        expect(achar('pao').stock).toBe(10)
        expect(r.body).toMatchObject({ updated: 0, unchanged: 1 })
        expect(db.product.update).not.toHaveBeenCalled()
    })

    it('mudou o preço: atualiza sem gravar estoque nenhum (não passa por cima da baixa das vendas)', async () => {
        produtos = [produto('pao', 'PAO FRANCES', 5, { stock: 10 })]
        await sincronizar([{ name: 'PAO FRANCES', displayId: 5, price: 12, stock: 50 }])
        expect(achar('pao')).toMatchObject({ price: 12, stock: 10 })
        expect(db.product.update.mock.calls[0][0].data).not.toHaveProperty('stock')
    })

    it('com estoqueDoSistemaDaLoja: true (opção do Sync por loja) volta o comportamento antigo', async () => {
        produtos = [produto('pao', 'PAO FRANCES', 5, { stock: 10 })]
        const r = await sincronizar([{ name: 'PAO FRANCES', displayId: 5, price: 10, stock: 50 }], { estoqueDoSistemaDaLoja: true })
        expect(achar('pao').stock).toBe(50)
        expect(r.body).toMatchObject({ updated: 1 })
    })

    it('produto novo nasce com o estoque do Athos', async () => {
        await sincronizar([{ name: 'BROA', displayId: 3700, price: 2, stock: 7 }])
        expect(noCodigo(3700)).toMatchObject({ name: 'BROA', stock: 7 })
    })
})

// Katatau (16/10/2026): o cadastro fiscal foi revisado na nuvem; o Athos não pode voltar o CFOP/CSOSN errado
describe('CSOSN e CFOP vindos do sistema da loja', () => {
    it('mudança de preço no Athos não troca o CSOSN/CFOP já acertado na nuvem', async () => {
        produtos = [{ ...produto('rothmans', 'ROTHMANS GLOBAL RED BOX', 2162), csosn: '500', cfop: '5405' }]
        await sincronizar([{ name: 'ROTHMANS GLOBAL RED BOX', displayId: 2162, price: 12, csosn: '500', cfop: '5102' }])
        const p = achar('rothmans')
        expect(p.price).toBe(12)
        expect(p).toMatchObject({ csosn: '500', cfop: '5405' })
    })

    it('produto sem CSOSN/CFOP na nuvem recebe o do Athos, já combinando', async () => {
        produtos = [{ ...produto('camel', 'CAMEL BOX', 2555), csosn: null, cfop: null }]
        await sincronizar([{ name: 'CAMEL BOX', displayId: 2555, price: 12, csosn: '500', cfop: '5102' }])
        expect(achar('camel')).toMatchObject({ csosn: '500', cfop: '5405' })
    })

    it('produto novo do Athos entra com o CFOP combinando com o CSOSN', async () => {
        await sincronizar([{ name: 'DETERGENTE', displayId: 3601, price: 3, csosn: '102', cfop: '5405' }])
        expect(produtos.find((x) => x.name === 'DETERGENTE')).toMatchObject({ csosn: '102', cfop: '5102' })
    })
})

describe('espelho do Athos (/api/pdv/sync/products/espelho)', () => {
    function lojaCom10() {
        produtos = Array.from({ length: 10 }, (_, i) => produto(`p${i + 1}`, `PRODUTO ${i + 1}`, i + 1))
        produtos.push(produto('copia', 'COPIA DO 1', 900001), produto('velho', 'JA INATIVO', 900002, { active: false }))
    }
    const athos = (codigos: number[], inativos: number[] = []) => codigos.map((c) => ({ codigo: c, ativo: !inativos.includes(c) }))

    it('desativa o que não existe no Athos e o que está inativo lá; não mexe no resto e nunca apaga', async () => {
        lojaCom10()
        const r = await espelhar(athos([1, 2, 3, 4, 5, 6, 7, 8, 9, 10], [3]))
        expect(r.code).toBe(200)
        expect(achar('copia')).toMatchObject({ active: false })
        expect(achar('copia').updated_at).toBeInstanceOf(Date)
        expect(achar('p3').active).toBe(false)
        expect(produtos.filter((p) => p.active).map((p) => p.display_id)).toEqual([1, 2, 4, 5, 6, 7, 8, 9, 10])
        expect(achar('velho').updated_at).toBeUndefined()
        expect(produtos).toHaveLength(12)
        expect(r.body).toMatchObject({ desativados: 2, recusado: false, foraDoSistema: [{ codigo: 900001, nome: 'COPIA DO 1' }], inativosNoSistema: [{ codigo: 3, nome: 'PRODUTO 3' }] })
    })

    it('trava: lista com menos de 80% dos produtos ativos da nuvem é recusada e nada muda', async () => {
        lojaCom10()
        const r = await espelhar(athos([1, 2, 3, 4, 5, 6, 7, 8]))
        expect(r.code).toBe(409)
        expect(r.body.recusado).toBe(true)
        expect(r.body.message).toContain('cobre só 8 dos 11 produtos ativos')
        expect(db.product.updateMany).not.toHaveBeenCalled()
        expect(produtos.filter((p) => p.active)).toHaveLength(11)
    })

    it('lista vazia é recusada', async () => {
        lojaCom10()
        const r = await espelhar([])
        expect(r.code).toBe(409)
        expect(db.product.updateMany).not.toHaveBeenCalled()
    })

    it('simular devolve o que mudaria e não grava', async () => {
        lojaCom10()
        const r = await espelhar(athos([1, 2, 3, 4, 5, 6, 7, 8, 9, 10], [3]), true)
        expect(r.code).toBe(200)
        expect(r.body).toMatchObject({ simulado: true, desativados: 0, foraDoSistema: [{ codigo: 900001 }], inativosNoSistema: [{ codigo: 3 }] })
        expect(db.product.updateMany).not.toHaveBeenCalled()
        expect(produtos.filter((p) => p.active)).toHaveLength(11)
    })
})

describe('mesmo produto ou outro produto no código', () => {
    it.each([
        ['CAFE PEQUENO PRETO', 'PO DE CAFE UNIAO EXTRAFORTE 500 G', false],
        ['MOUSSE GRANDE UNID', 'SNICKERS MOUSSE DE MARACUJA 42G', false],
        ['ALVEJANTE SAIF 500ML S/CL E BRANQUE', 'CHOCOLATE EM PÓ NEILAR 200G', false],
        ['MASSA DE LASANHA DONA BENTA 500G', 'MASSA DE LASANHA PARATI', false],
        ['COCA COLA 2L', 'COCA COLA 600ML', false],
        ['RODO PASSA CERA MJ', 'RODO PASSA CERA MJ 30CM', true],
        ['AÇUCAR REF UNIÃO', 'ACUCAR REFINADO UNIAO 1KG', true],
        ['PÃO FRANCÊS', 'pao frances', true],
        ['COXINHA', 'COXINHA DE FRANGO', true],
        ['AGUA SANITARIA TAY 2 L', 'AGUA SANITARIA TAY 2L', true],
    ])('"%s" x "%s" = mesmo produto? %s', (a, b, esperado) => {
        expect(mesmoProduto(a, null, b, null)).toBe(esperado)
    })

    it('o mesmo código de barras é o mesmo produto, mesmo com outro nome', () => {
        expect(mesmoProduto('REFRI LATA', '7894900011517', 'COCA COLA LATA 350ML', '7894900011517')).toBe(true)
    })

    it('plano do espelho: produto sem situação (null) conta como ativo', () => {
        const plano = planoDoEspelho([{ id: 'a', display_id: 1, name: 'A', active: null }, { id: 'b', display_id: 2, name: 'B', active: true }], [{ codigo: 2, ativo: true }])
        expect(plano).toMatchObject({ ativosNaNuvem: 2, cobertos: 1, recusar: true })
    })
})
