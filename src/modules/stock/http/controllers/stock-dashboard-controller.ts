import { FastifyRequest, FastifyReply } from 'fastify'
import { Prisma, StockReason } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'
import { registrarMovimento, usuarioDaRequisicao } from '../../services/movimento-de-estoque'
import { intervaloDoPeriodo, unidadeDoItem } from '../../services/historico-do-estoque'
import { situacaoDoSaldo } from '../../services/posicao-do-estoque'

// Etapa 4 do Vendas e Estoque (16/10/2026): as telas do Controle de Estoque mostravam números de exemplo quando a consulta não
// trazia nada (estoque mínimo inventado por unidade, "Câmara Fria 02", vendas de demonstração na ficha técnica). Agora só
// dado real; sem dado, a tela mostra o vazio de verdade.

/** Produto que baixa a si mesmo (D8): o que tem ficha técnica é baixado pelos insumos, então não tem saldo próprio. */
const semFichaTecnica: Prisma.ProductWhereInput = { NOT: { AND: [{ is_composite: true }, { compositions: { some: {} } }] } }

// 1. Visão Geral / Estoque Atual (Posição de Estoque)
export async function getStockOverview(request: FastifyRequest, reply: FastifyReply) {
    const querySchema = z.object({
        query: z.string().optional(),
        category: z.string().optional(),
        onlyLowStock: z.preprocess(v => v === true || v === 'true' || v === '1', z.boolean()).optional().default(false),
        page: z.coerce.number().int().min(1).default(1),
        perPage: z.coerce.number().int().min(1).max(500).default(50),
    })

    const { query, category, onlyLowStock, page, perPage } = querySchema.parse(request.query)
    const categoria = category && category !== 'Todos' && category !== 'ALL' ? category : null
    const texto = (query ?? '').trim()
    const codigo = /^\d{1,9}$/.test(texto) ? Number(texto) : null

    const whereSupply: Prisma.SupplyWhereInput = { active: true }
    if (categoria) whereSupply.category = { equals: categoria, mode: 'insensitive' }
    if (texto) {
        whereSupply.OR = [
            { name: { contains: texto, mode: 'insensitive' } },
            { description: { contains: texto, mode: 'insensitive' } },
        ]
    }

    const [supplies, products] = await Promise.all([
        prisma.supply.findMany({
            where: whereSupply,
            orderBy: { name: 'asc' },
            include: { stocks: { take: 1, orderBy: { created_at: 'desc' }, select: { created_at: true } } },
        }),
        prisma.product.findMany({
            where: {
                active: true,
                ...semFichaTecnica,
                ...(categoria ? { category: { name: { equals: categoria, mode: 'insensitive' } } } : {}),
                ...(texto
                    ? {
                        OR: [
                            { name: { contains: texto, mode: 'insensitive' } },
                            { barcode: texto },
                            ...(codigo !== null ? [{ display_id: codigo }] : []),
                        ],
                    }
                    : {}),
            },
            include: {
                category: { select: { name: true } },
                stocks: { take: 1, orderBy: { created_at: 'desc' }, select: { created_at: true } },
            },
            orderBy: { name: 'asc' },
        }),
    ])

    const itens = [
        ...supplies.map((s) => {
            const saldo = s.stock ?? 0
            return {
                id: s.id,
                name: s.name,
                type: 'SUPPLY' as const,
                code: null as number | null,
                category: s.category || 'Sem categoria',
                unit: unidadeDoItem(null, s),
                currentStock: saldo,
                // Insumo não tem estoque mínimo no cadastro: só o saldo zerado ou negativo avisa
                minStock: null as number | null,
                cost: s.cost || 0,
                situation: situacaoDoSaldo(saldo, null),
                lastMovement: s.stocks[0]?.created_at ?? null,
            }
        }),
        ...products.map((p) => {
            const saldo = p.stock ?? 0
            const minimo = p.min_stock && p.min_stock > 0 ? p.min_stock : null
            return {
                id: p.id,
                name: p.name,
                type: 'PRODUCT' as const,
                code: p.display_id as number | null,
                category: p.category?.name || 'Sem categoria',
                unit: unidadeDoItem(p, null),
                currentStock: saldo,
                minStock: minimo,
                cost: p.cost || 0,
                price: p.price,
                situation: situacaoDoSaldo(saldo, minimo),
                lastMovement: p.stocks[0]?.created_at ?? null,
            }
        }),
    ].sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'))

    const lowStockCount = itens.filter(i => i.situation !== 'NORMAL').length
    const filtrados = onlyLowStock ? itens.filter(i => i.situation !== 'NORMAL') : itens
    const categorias = [...new Set(itens.map(i => i.category))].sort((a, b) => a.localeCompare(b, 'pt-BR'))

    return reply.send({
        items: filtrados.slice((page - 1) * perPage, page * perPage),
        categories: categorias,
        summary: {
            totalCount: itens.length,
            lowStockCount,
            normalCount: itens.length - lowStockCount,
            filteredCount: filtrados.length,
            page,
            perPage,
            totalPages: Math.max(1, Math.ceil(filtrados.length / perPage)),
        },
    })
}

const MOTIVOS_QUE_SO_TIRAM = ['QUEBRA', 'PERDA', 'CONSUMO_INTERNO', 'AJUSTE_NEGATIVO']
const MOTIVOS_QUE_SO_SOMAM = ['COMPRA', 'DEVOLUCAO', 'AJUSTE_POSITIVO']

/**
 * O motivo do ajuste combina com a direção? Ajuste (+/-) segue a diferença; quebra, perda e consumo só tiram; compra e
 * devolução só somam (antes um "sobra +" que baixava o saldo ficava gravado como AJUSTE_POSITIVO de saída).
 */
export function motivoDoAjuste(motivo: string, diferenca: number): { motivo: StockReason } | { erro: string } {
    if (motivo === 'AJUSTE_POSITIVO' || motivo === 'AJUSTE_NEGATIVO') return { motivo: diferenca > 0 ? 'AJUSTE_POSITIVO' : 'AJUSTE_NEGATIVO' }
    if (diferenca > 0 && MOTIVOS_QUE_SO_TIRAM.includes(motivo)) return { erro: 'Quebra, perda e consumo só diminuem o saldo. Para aumentar, escolha "Ajuste".' }
    if (diferenca < 0 && MOTIVOS_QUE_SO_SOMAM.includes(motivo)) return { erro: 'Compra e devolução só aumentam o saldo. Para diminuir, escolha "Ajuste" ou uma perda.' }
    return { motivo: motivo as StockReason }
}

const NOMES_DOS_MOTIVOS: Record<string, string> = {
    AJUSTE_POSITIVO: 'Ajuste (sobra)',
    AJUSTE_NEGATIVO: 'Ajuste (falta)',
    QUEBRA: 'Quebra / avaria',
    PERDA: 'Perda / descarte',
    CONSUMO_INTERNO: 'Consumo interno',
    COMPRA: 'Compra',
    DEVOLUCAO: 'Devolução',
}

// 2. Ajuste Manual Rápido de Saldo
export async function postAdjustStockBalance(request: FastifyRequest, reply: FastifyReply) {
    const adjustSchema = z.object({
        targetId: z.string().uuid(),
        targetType: z.enum(['SUPPLY', 'PRODUCT']),
        newStock: z.number().min(0),
        reason: z.enum([
            'AJUSTE_POSITIVO',
            'AJUSTE_NEGATIVO',
            'QUEBRA',
            'PERDA',
            'CONSUMO_INTERNO',
            'COMPRA',
            'DEVOLUCAO'
        ]),
        notes: z.string().max(300).optional(),
    })

    const { targetId, targetType, newStock, reason, notes } = adjustSchema.parse(request.body)

    const cadastro = targetType === 'SUPPLY'
        ? await prisma.supply.findUnique({ where: { id: targetId }, select: { name: true, stock: true, cost: true } })
        : await prisma.product.findUnique({ where: { id: targetId }, select: { name: true, stock: true, cost: true } })
    if (!cadastro) return reply.status(404).send({ message: targetType === 'SUPPLY' ? 'Insumo não encontrado.' : 'Produto não encontrado.' })

    const atual = cadastro.stock ?? 0
    const diferenca = Number((newStock - atual).toFixed(6))
    if (diferenca === 0) {
        return reply.send({ message: 'O saldo já é esse: nada mudou.', previousStock: atual, newStock, diff: 0 })
    }
    const escolha = motivoDoAjuste(reason, diferenca)
    if ('erro' in escolha) return reply.status(400).send({ message: escolha.erro })

    const usuario = await usuarioDaRequisicao(request)
    const observacao = (notes ?? '').trim()
    await prisma.$transaction(async (tx) => {
        await registrarMovimento(tx, {
            alvo: { tipo: targetType, id: targetId },
            operacao: diferenca > 0 ? 'IN' : 'OUT',
            quantidade: Math.abs(diferenca),
            motivo: escolha.motivo,
            custoUnitario: cadastro.cost ?? 0,
            saldoNovo: newStock,
            usuario,
            nota: observacao ? `${NOMES_DOS_MOTIVOS[escolha.motivo] ?? 'Ajuste'}: ${observacao}` : (NOMES_DOS_MOTIVOS[escolha.motivo] ?? 'Ajuste'),
        })
    })

    return reply.status(200).send({
        message: `Saldo de "${cadastro.name}" ajustado para ${newStock}.`,
        previousStock: atual,
        newStock,
        diff: diferenca
    })
}

// 3. Cadastro Rápido de Novo Insumo
export async function postCreateStockSupply(request: FastifyRequest, reply: FastifyReply) {
    const supplySchema = z.object({
        name: z.string().trim().min(2, 'Nome é obrigatório'),
        category: z.string().optional().default('Geral'),
        unit: z.string().optional().default('UN'),
        cost: z.number().min(0).default(0),
        initialStock: z.number().min(0).default(0),
        description: z.string().optional(),
    })

    const { name, category, unit, cost, initialStock, description } = supplySchema.parse(request.body)
    const usuario = await usuarioDaRequisicao(request)

    const createdSupply = await prisma.$transaction(async (tx) => {
        const supply = await tx.supply.create({ data: { name, category, unit, cost, stock: 0, description } })
        if (initialStock > 0) {
            await registrarMovimento(tx, {
                alvo: { tipo: 'SUPPLY', id: supply.id },
                operacao: 'IN',
                quantidade: initialStock,
                motivo: 'AJUSTE_POSITIVO',
                custoUnitario: cost,
                usuario,
                nota: 'Saldo inicial do cadastro',
            })
        }
        return { ...supply, stock: initialStock }
    })

    return reply.status(201).send(createdSupply)
}

// 4. Sessão Ativa de Inventário (Balanço Físico)
export async function getActiveInventorySession(request: FastifyRequest, reply: FastifyReply) {
    // Procura por sessão OPEN
    let session = await prisma.inventorySession.findFirst({
        where: { status: 'OPEN' },
        orderBy: { opened_at: 'desc' },
        include: {
            items: {
                include: {
                    supply: { select: { id: true, name: true, unit: true, cost: true, category: true } },
                    product: { select: { id: true, name: true, cost: true, measureUnit: true, category: { select: { name: true } } } }
                },
                orderBy: { id: 'asc' }
            }
        }
    })

    // Se não houver sessão aberta, abre uma automaticamente com todos os itens que têm saldo próprio
    if (!session) {
        const [supplies, products] = await Promise.all([
            prisma.supply.findMany({ where: { active: true } }),
            prisma.product.findMany({ where: { active: true, ...semFichaTecnica } })
        ])

        if (supplies.length > 0 || products.length > 0) {
            session = await prisma.$transaction(async (tx) => {
                const newSession = await tx.inventorySession.create({
                    data: {
                        user_id: (request.user as { sub?: string } | undefined)?.sub ?? null,
                        sector: 'GERAL',
                        blind_count: false,
                        notes: 'Contagem de estoque',
                        status: 'OPEN'
                    }
                })

                const itemsData: Prisma.InventoryItemCreateManyInput[] = [
                    ...supplies.map(s => ({
                        inventory_session_id: newSession.id,
                        supply_id: s.id,
                        system_quantity: s.stock ?? 0,
                        counted_quantity: s.stock ?? 0, // Inicia igual ao sistema para conferência ágil
                        unit_cost: s.cost ?? 0,
                    })),
                    ...products.map(p => ({
                        inventory_session_id: newSession.id,
                        product_id: p.id,
                        system_quantity: p.stock ?? 0,
                        counted_quantity: p.stock ?? 0,
                        unit_cost: p.cost ?? 0,
                    }))
                ]

                await tx.inventoryItem.createMany({ data: itemsData })

                return tx.inventorySession.findUnique({
                    where: { id: newSession.id },
                    include: {
                        items: {
                            include: {
                                supply: { select: { id: true, name: true, unit: true, cost: true, category: true } },
                                product: { select: { id: true, name: true, cost: true, measureUnit: true, category: { select: { name: true } } } }
                            },
                            orderBy: { id: 'asc' }
                        }
                    }
                })
            }, { timeout: 60000, maxWait: 10000 })
        }
    }

    if (!session) {
        return reply.send({ sessionId: null, status: null, items: [] })
    }

    const formattedItems = session.items.map(item => {
        const diff = item.counted_quantity - item.system_quantity
        return {
            id: item.id,
            name: item.supply?.name || item.product?.name || 'Item apagado',
            type: item.supply_id ? 'SUPPLY' : 'PRODUCT',
            category: item.supply?.category || item.product?.category?.name || 'Sem categoria',
            unit: unidadeDoItem(item.product, item.supply),
            systemQuantity: item.system_quantity,
            countedQuantity: item.counted_quantity,
            difference: diff,
            unitCost: item.unit_cost,
            totalDiffCost: diff * item.unit_cost,
        }
    }).sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'))

    return reply.send({
        sessionId: session.id,
        status: session.status,
        sector: session.sector,
        openedAt: session.opened_at,
        items: formattedItems
    })
}

// 5. Consumo por Ficha Técnica (de onde vieram as baixas dos insumos)
/**
 * Só dado real (antes havia "vendas de demonstração" e um local fixo "Câmara Fria 02"): os insumos que estão numa ficha técnica
 * (de produto composto, D8) ou ligados a um complemento, e o que foi baixado deles no período pelas vendas (saídas menos os
 * estornos), separado pelo produto vendido. Sem ficha nem complemento ligado, a tela mostra o vazio com o caminho para cadastrar.
 */
export async function getRecipeConsumption(request: FastifyRequest, reply: FastifyReply) {
    const { period, from, to } = z.object({
        period: z.string().optional().default('today'),
        from: z.string().optional(),
        to: z.string().optional(),
    }).parse(request.query)
    const { inicio, fim } = intervaloDoPeriodo(period, from, to)

    const [fichas, opcoes] = await Promise.all([
        prisma.composition.findMany({
            where: { product: { is: { is_composite: true } } },
            select: {
                quantity: true,
                supply_id: true,
                product: { select: { id: true, name: true, display_id: true, active: true } },
            },
        }),
        prisma.complementOption.findMany({
            where: { linked_supply_id: { not: null } },
            select: { id: true, name: true, supply_quantity: true, active: true, linked_supply_id: true, group: { select: { name: true } } },
        }),
    ])

    const baixas = await prisma.stock.findMany({
        where: {
            supply_id: { not: null },
            sale_item_id: { not: null },
            description: { in: ['VENDA', 'DEVOLUCAO'] },
            ...(inicio || fim ? { created_at: { ...(inicio ? { gte: inicio } : {}), ...(fim ? { lt: fim } : {}) } } : {}),
        },
        select: {
            supply_id: true,
            operation: true,
            quantity: true,
            unit_cost: true,
            sale_item_id: true,
            saleItem: { select: { quantity: true, product_id: true, sold_name: true, product: { select: { name: true } } } },
        },
    })

    const idsDosInsumos = new Set<string>()
    for (const f of fichas) idsDosInsumos.add(f.supply_id)
    for (const o of opcoes) if (o.linked_supply_id) idsDosInsumos.add(o.linked_supply_id)
    for (const b of baixas) if (b.supply_id) idsDosInsumos.add(b.supply_id)

    const insumos = idsDosInsumos.size > 0
        ? await prisma.supply.findMany({ where: { id: { in: [...idsDosInsumos] } }, select: { id: true, name: true, unit: true, cost: true, stock: true, category: true, active: true } })
        : []

    type PorProduto = { productId: string | null; productName: string; quantity: number; cost: number; itens: Map<string, { vendido: number; liquido: number }> }
    const porInsumo = new Map<string, Map<string, PorProduto>>()
    for (const b of baixas) {
        if (!b.supply_id || !b.sale_item_id) continue
        const chave = b.saleItem?.product_id ?? `sem:${b.saleItem?.sold_name ?? ''}`
        const doInsumo = porInsumo.get(b.supply_id) ?? new Map<string, PorProduto>()
        porInsumo.set(b.supply_id, doInsumo)
        const linha = doInsumo.get(chave) ?? {
            productId: b.saleItem?.product_id ?? null,
            productName: b.saleItem?.product?.name ?? b.saleItem?.sold_name ?? 'Item sem produto',
            quantity: 0, cost: 0, itens: new Map(),
        }
        doInsumo.set(chave, linha)
        const sinal = b.operation === 'OUT' ? 1 : -1
        linha.quantity += sinal * b.quantity
        linha.cost += sinal * b.quantity * (b.unit_cost ?? 0)
        const item = linha.itens.get(b.sale_item_id) ?? { vendido: b.saleItem?.quantity ?? 0, liquido: 0 }
        item.liquido += sinal * b.quantity
        linha.itens.set(b.sale_item_id, item)
    }

    const r2 = (v: number) => Number(v.toFixed(4))
    const supplies = insumos.map(s => {
        const usos = [
            ...fichas.filter(f => f.supply_id === s.id && f.product).map(f => ({
                kind: 'FICHA' as const, id: f.product!.id, name: f.product!.name, group: null as string | null, dose: f.quantity, active: f.product!.active !== false,
            })),
            ...opcoes.filter(o => o.linked_supply_id === s.id).map(o => ({
                kind: 'COMPLEMENTO' as const, id: o.id, name: o.name, group: o.group?.name ?? null, dose: o.supply_quantity && o.supply_quantity > 0 ? o.supply_quantity : 1, active: o.active,
            })),
        ]
        const linhas = [...(porInsumo.get(s.id)?.values() ?? [])].map(l => ({
            productId: l.productId,
            productName: l.productName,
            quantity: r2(l.quantity),
            cost: Number(l.cost.toFixed(2)),
            itemsSold: r2([...l.itens.values()].filter(i => i.liquido > 0).reduce((t, i) => t + i.vendido, 0)),
        })).filter(l => l.quantity !== 0).sort((a, b) => b.quantity - a.quantity)
        const consumido = linhas.reduce((t, l) => t + l.quantity, 0)
        return {
            id: s.id,
            name: s.name,
            unit: unidadeDoItem(null, s),
            category: s.category || 'Sem categoria',
            active: s.active !== false,
            currentStock: s.stock ?? 0,
            unitCost: s.cost ?? 0,
            consumed: r2(consumido),
            consumedCost: Number(linhas.reduce((t, l) => t + l.cost, 0).toFixed(2)),
            usedIn: usos,
            byProduct: linhas.map(l => ({ ...l, percentage: consumido > 0 ? Number(((l.quantity / consumido) * 100).toFixed(1)) : 0 })),
        }
    }).sort((a, b) => (b.consumed - a.consumed) || a.name.localeCompare(b.name, 'pt-BR'))

    return reply.send({
        period,
        recipesCount: new Set(fichas.filter(f => f.product).map(f => f.product!.id)).size,
        linkedOptionsCount: opcoes.length,
        supplies,
    })
}
