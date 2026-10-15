import type { PrismaClient } from '@prisma/client'
import type { Catalogo, ItemEnviado, ProdutoCatalogo } from './pedido-online-regras'

// Mergulho (06:C6): o que a nuvem precisa ler do cadastro para refazer o preço do pedido do cardápio online.
// Lê também grupo/opção desativados: o preço continua sendo o cadastrado, e um cliente com o cardápio aberto antes da
// mudança não fica travado (o cardápio só mostra os ativos).
const SELECAO = {
    id: true,
    name: true,
    price: true,
    category_id: true,
    subcategory: { select: { accepts_fractions: true } },
    complementGroups: {
        select: {
            order: true,
            group: {
                select: {
                    id: true,
                    name: true,
                    free_quantity: true,
                    options: { select: { id: true, name: true, price: true } },
                },
            },
        },
        orderBy: { order: 'asc' as const },
    },
}

function paraProdutoCatalogo(p: any): ProdutoCatalogo {
    return {
        id: p.id,
        name: p.name,
        price: Number(p.price) || 0,
        category_id: p.category_id ?? null,
        accepts_fractions: Boolean(p.subcategory?.accepts_fractions),
        grupos: (p.complementGroups || []).map((cg: any) => ({
            id: cg.group.id,
            name: cg.group.name,
            free_quantity: Number(cg.group.free_quantity) || 0,
            options: (cg.group.options || []).map((o: any) => ({ id: o.id, name: o.name, price: Number(o.price) || 0 })),
        })),
    }
}

/** Busca os produtos do pedido (pelo id) e os sabores das frações (pelo id novo ou pelo nome). */
export async function carregarCatalogoDoPedido(prisma: PrismaClient, itens: ItemEnviado[]): Promise<Catalogo> {
    const ids = new Set<string>()
    const nomes = new Set<string>()
    for (const item of itens) {
        if (typeof item.product_id === 'string' && item.product_id) ids.add(item.product_id)
        if (Array.isArray(item.fractions)) {
            for (const f of item.fractions as any[]) {
                if (typeof f?.flavor_id === 'string' && f.flavor_id) ids.add(f.flavor_id)
                if (typeof f?.name === 'string' && f.name.trim()) nomes.add(f.name.trim())
            }
        }
    }

    const filtros: any[] = []
    if (ids.size > 0) filtros.push({ id: { in: Array.from(ids) } })
    for (const nome of nomes) filtros.push({ name: { equals: nome, mode: 'insensitive' } })
    if (filtros.length === 0) return { porId: new Map(), fracionaveis: [] }

    const produtos = await prisma.product.findMany({ where: { OR: filtros }, select: SELECAO })
    const lista = produtos.map(paraProdutoCatalogo)
    return {
        porId: new Map(lista.map((p) => [p.id, p])),
        fracionaveis: lista.filter((p) => p.accepts_fractions),
    }
}
