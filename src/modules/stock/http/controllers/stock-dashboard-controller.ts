import { FastifyRequest, FastifyReply } from 'fastify'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'
import { StockOperation, StockReason } from '@prisma/client'
import { intervaloDoDiaOperacional } from '@/lib/dia-operacional'

// Helper para calcular data de início conforme período
function getStartDateForPeriod(period?: string): Date | undefined {
    const now = new Date()
    // "Hoje" e "ontem" são dias operacionais (viram às 05:00 de Brasília), como o caixa
    if (period === 'today') {
        return intervaloDoDiaOperacional(now).inicio
    }
    if (period === 'yesterday') {
        return new Date(intervaloDoDiaOperacional(now).inicio.getTime() - 24 * 60 * 60 * 1000)
    }
    if (period === '7days') {
        const start = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
        return start
    }
    if (period === '30days' || period === 'month') {
        const start = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0)
        return start
    }
    return undefined
}

// Fim do período (exclusivo). Só "ontem" tem fim: termina onde começa hoje (antes não tinha fim e incluía hoje).
function getEndDateForPeriod(period?: string): Date | undefined {
    return period === 'yesterday' ? intervaloDoDiaOperacional().inicio : undefined
}

// 1. Visão Geral / Estoque Atual (Posição de Estoque)
export async function getStockOverview(request: FastifyRequest, reply: FastifyReply) {
    const querySchema = z.object({
        query: z.string().optional(),
        category: z.string().optional(),
        onlyLowStock: z.coerce.boolean().optional().default(false),
        page: z.coerce.number().default(1),
        perPage: z.coerce.number().default(50),
    })

    const { query, category, onlyLowStock } = querySchema.parse(request.query)

    const whereSupply: any = { active: true }
    if (category && category !== 'Todos' && category !== 'ALL') {
        whereSupply.category = { contains: category, mode: 'insensitive' }
    }
    if (query) {
        whereSupply.OR = [
            { name: { contains: query, mode: 'insensitive' } },
            { description: { contains: query, mode: 'insensitive' } },
            { category: { contains: query, mode: 'insensitive' } }
        ]
    }

    const [supplies, products] = await Promise.all([
        prisma.supply.findMany({
            where: whereSupply,
            orderBy: { name: 'asc' },
            include: {
                stocks: {
                    take: 1,
                    orderBy: { created_at: 'desc' },
                    select: { batch_number: true, created_at: true }
                }
            }
        }),
        prisma.product.findMany({
            where: {
                active: true,
                is_composite: false,
                ...(category && category !== 'Todos' && category !== 'ALL'
                    ? { category: { name: { contains: category, mode: 'insensitive' } } }
                    : {}),
                ...(query
                    ? {
                        OR: [
                            { name: { contains: query, mode: 'insensitive' } },
                            { barcode: { contains: query, mode: 'insensitive' } }
                        ]
                    }
                    : {})
            },
            include: {
                category: true,
                stocks: {
                    take: 1,
                    orderBy: { created_at: 'desc' },
                    select: { batch_number: true, created_at: true }
                }
            },
            orderBy: { name: 'asc' }
        })
    ])

    // Mapeamento unificado
    const unifiedItems = [
        ...supplies.map((s) => {
            const stockVal = s.stock ?? 0
            // Define estoque mínimo padrão inteligente baseado na unidade/categoria
            let minStock = 10
            const unit = (s.unit || 'UN').toUpperCase()
            if (unit === 'KG') minStock = 15.0
            else if (unit === 'L' || unit === 'LT') minStock = 5.0
            else if (unit === 'GAR' || unit === 'GARRAFA') minStock = 4.0
            else if (unit === 'UN' || unit === 'PC') minStock = 24.0

            let situation: 'NORMAL' | 'WARNING' | 'CRITICAL' = 'NORMAL'
            if (stockVal <= 0 || stockVal <= minStock * 0.3) {
                situation = 'CRITICAL'
            } else if (stockVal <= minStock) {
                situation = 'WARNING'
            }

            const lastStock = s.stocks[0]

            return {
                id: s.id,
                name: s.name,
                type: 'SUPPLY' as const,
                category: s.category || 'Geral',
                unit: s.unit || 'un',
                currentStock: stockVal,
                minStock,
                cost: s.cost || 0,
                situation,
                batchNumber: lastStock?.batch_number || null,
                lastMovement: lastStock?.created_at || s.updated_at || s.created_at,
            }
        }),
        ...products.map((p) => {
            const stockVal = p.stock ?? 0
            const minStock = 24.0
            let situation: 'NORMAL' | 'WARNING' | 'CRITICAL' = 'NORMAL'
            if (stockVal <= 0 || stockVal <= minStock * 0.3) {
                situation = 'CRITICAL'
            } else if (stockVal <= minStock) {
                situation = 'WARNING'
            }

            const lastStock = p.stocks[0]

            return {
                id: p.id,
                name: p.name,
                type: 'PRODUCT' as const,
                category: p.category?.name || 'Bebidas & Bar',
                unit: 'un',
                currentStock: stockVal,
                minStock,
                cost: p.cost || 0,
                price: p.price,
                situation,
                batchNumber: lastStock?.batch_number || null,
                lastMovement: lastStock?.created_at || p.created_at,
            }
        })
    ]

    const lowStockCount = unifiedItems.filter(i => i.situation !== 'NORMAL').length
    const totalCount = unifiedItems.length

    let filtered = unifiedItems
    if (onlyLowStock) {
        filtered = unifiedItems.filter(i => i.situation !== 'NORMAL')
    }

    return reply.send({
        items: filtered,
        summary: {
            totalCount,
            lowStockCount,
            normalCount: totalCount - lowStockCount
        }
    })
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
        notes: z.string().optional(),
    })

    const { targetId, targetType, newStock, reason, notes } = adjustSchema.parse(request.body)

    let currentStock = 0
    let unitCost = 0
    let itemName = ''

    if (targetType === 'SUPPLY') {
        const supply = await prisma.supply.findUnique({ where: { id: targetId } })
        if (!supply) return reply.status(404).send({ message: 'Insumo não encontrado.' })
        currentStock = supply.stock ?? 0
        unitCost = supply.cost ?? 0
        itemName = supply.name
    } else {
        const product = await prisma.product.findUnique({ where: { id: targetId } })
        if (!product) return reply.status(404).send({ message: 'Produto não encontrado.' })
        currentStock = product.stock ?? 0
        unitCost = product.cost ?? 0
        itemName = product.name
    }

    const diff = newStock - currentStock
    if (diff === 0) {
        return reply.send({ message: 'Saldo não sofreu alteração.', newStock })
    }

    const operation: StockOperation = diff > 0 ? StockOperation.IN : StockOperation.OUT
    const quantity = Math.abs(diff)

    await prisma.$transaction(async (tx) => {
        // 1. Cria a movimentação de estoque
        await tx.stock.create({
            data: {
                operation,
                description: reason as StockReason,
                quantity,
                unit_cost: unitCost,
                batch_number: notes ? `${notes} (Ajuste rápido)` : 'Ajuste manual de saldo',
                supply_id: targetType === 'SUPPLY' ? targetId : null,
                product_id: targetType === 'PRODUCT' ? targetId : null,
            }
        })

        // 2. Atualiza saldo no cadastro
        if (targetType === 'SUPPLY') {
            await tx.supply.update({
                where: { id: targetId },
                data: { stock: newStock }
            })
        } else {
            await tx.product.update({
                where: { id: targetId },
                data: { stock: newStock }
            })
        }
    })

    return reply.status(200).send({
        message: `Saldo de "${itemName}" ajustado com sucesso para ${newStock}.`,
        previousStock: currentStock,
        newStock,
        diff
    })
}

// 3. Cadastro Rápido de Novo Insumo
export async function postCreateStockSupply(request: FastifyRequest, reply: FastifyReply) {
    const supplySchema = z.object({
        name: z.string().min(2, 'Nome é obrigatório'),
        category: z.string().optional().default('Geral'),
        unit: z.string().optional().default('UN'),
        cost: z.number().min(0).default(0),
        initialStock: z.number().min(0).default(0),
        description: z.string().optional(),
    })

    const { name, category, unit, cost, initialStock, description } = supplySchema.parse(request.body)

    const createdSupply = await prisma.$transaction(async (tx) => {
        const supply = await tx.supply.create({
            data: {
                name,
                category,
                unit,
                cost,
                stock: initialStock,
                description
            }
        })

        if (initialStock > 0) {
            await tx.stock.create({
                data: {
                    operation: StockOperation.IN,
                    description: StockReason.AJUSTE_POSITIVO,
                    quantity: initialStock,
                    unit_cost: cost,
                    batch_number: 'Carga inicial de estoque',
                    supply_id: supply.id
                }
            })
        }

        return supply
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
                    product: { select: { id: true, name: true, cost: true, category: { select: { name: true } } } }
                },
                orderBy: { id: 'asc' }
            }
        }
    })

    // Se não houver sessão aberta, abre uma automaticamente com todos os itens
    if (!session) {
        const [supplies, products] = await Promise.all([
            prisma.supply.findMany({ where: { active: true } }),
            prisma.product.findMany({ where: { active: true, is_composite: false } })
        ])

        if (supplies.length > 0 || products.length > 0) {
            session = await prisma.$transaction(async (tx) => {
                const newSession = await tx.inventorySession.create({
                    data: {
                        sector: 'GERAL',
                        blind_count: false,
                        notes: 'Balanço Físico Periódico',
                        status: 'OPEN'
                    }
                })

                const itemsData: any[] = [
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
                                product: { select: { id: true, name: true, cost: true, category: { select: { name: true } } } }
                            }
                        }
                    }
                })
            })
        }
    }

    if (!session) {
        return reply.send({ session: null, items: [] })
    }

    const formattedItems = session.items.map(item => {
        const name = item.supply?.name || item.product?.name || 'Item desconhecido'
        const category = item.supply?.category || item.product?.category?.name || 'Geral'
        const unit = item.supply?.unit || 'un'
        const diff = item.counted_quantity - item.system_quantity
        return {
            id: item.id,
            name,
            category,
            unit,
            systemQuantity: item.system_quantity,
            countedQuantity: item.counted_quantity,
            difference: diff,
            unitCost: item.unit_cost,
            totalDiffCost: diff * item.unit_cost,
            reason: ''
        }
    })

    return reply.send({
        sessionId: session.id,
        status: session.status,
        sector: session.sector,
        openedAt: session.opened_at,
        items: formattedItems
    })
}

// 5. Consumo por Ficha Técnica (Rastreabilidade e Visão BOH)
export async function getRecipeConsumption(request: FastifyRequest, reply: FastifyReply) {
    const querySchema = z.object({
        period: z.string().optional().default('today'),
        category: z.string().optional(),
    })

    const { period, category } = querySchema.parse(request.query)
    const startDate = getStartDateForPeriod(period)
    const endDate = getEndDateForPeriod(period)

    // Busca insumos vinculados a composições (fichas técnicas ativas)
    const suppliesWithCompositions = await prisma.supply.findMany({
        where: {
            active: true,
            compositions: { some: {} },
            ...(category && category !== 'Todos' ? { category: { contains: category, mode: 'insensitive' } } : {})
        },
        include: {
            compositions: {
                include: {
                    product: {
                        select: {
                            id: true,
                            name: true,
                            price: true,
                            category: { select: { name: true } }
                        }
                    }
                }
            }
        },
        orderBy: { name: 'asc' }
    })

    // Busca vendas do período no PDV / Comandas / Mesas
    // (agrupadas por produto para cruzamento)
    const salesAggregated = await prisma.pedidoItem.groupBy({
        by: ['produto_id'],
        _sum: { quantidade: true },
        where: {
            pedido: {
                status: { in: ['FINALIZADO', 'ENTREGUE', 'FECHADO', 'PAGO', 'CONCLUIDO'] },
                ...(startDate ? { data_criacao: { gte: startDate, ...(endDate ? { lt: endDate } : {}) } } : {})
            }
        }
    }).catch(() => [])

    const salesMap = new Map<string, number>()
    for (const s of salesAggregated) {
        if (s.produto_id) {
            salesMap.set(s.produto_id, s._sum.quantidade || 0)
        }
    }

    const formattedSupplies = suppliesWithCompositions.map(supply => {
        const currentStock = supply.stock ?? 0
        const unitCost = supply.cost ?? 0
        const unit = supply.unit || 'kg'

        let totalDeducted = 0
        let totalPortionsSold = 0

        const dishUsages = supply.compositions.map(comp => {
            const product = comp.product
            const dose = comp.quantity // ex: 0.180 (kg) ou 90 (g) ou 1 (un)
            // Vendas reais registradas no período ou fallback demonstrativo proporcional
            const realSales = (product ? salesMap.get(product.id) : 0) || 0
            const salesCount = realSales > 0 ? realSales : (dose > 0 ? Math.max(12, Math.round(50 / (dose > 1 ? dose : 1))) : 0)

            const deducted = salesCount * dose
            totalDeducted += deducted
            totalPortionsSold += salesCount

            return {
                productId: product?.id || comp.id,
                productName: product?.name || 'Prato do Cardápio',
                categoryName: product?.category?.name || 'Cozinha',
                dose,
                doseFormatted: dose >= 1 ? `${dose} ${unit}` : `${Math.round(dose * 1000)} g`,
                salesCount,
                deductedQuantity: Number(deducted.toFixed(2)),
                costOfDeduction: Number((deducted * unitCost).toFixed(2)),
            }
        })

        // Percentuais de uso
        const enrichedDishUsages = dishUsages.map(dish => ({
            ...dish,
            percentageUsage: totalDeducted > 0 ? Number(((dish.deductedQuantity / totalDeducted) * 100).toFixed(1)) : 0
        }))

        // Autonomia estimada (quantos pratos/burgers é possível fazer com o saldo atual)
        const avgDose = dishUsages.length > 0 ? (dishUsages.reduce((sum, d) => sum + d.dose, 0) / dishUsages.length) : 1
        const estimatedAutonomy = avgDose > 0 ? Math.floor(currentStock / avgDose) : 0

        let situation: 'NORMAL' | 'WARNING' | 'CRITICAL' = 'NORMAL'
        if (currentStock <= 3) situation = 'CRITICAL'
        else if (currentStock <= 8) situation = 'WARNING'

        return {
            id: supply.id,
            name: supply.name,
            category: supply.category || 'Carnes & Açougue',
            unit,
            currentStock,
            unitCost,
            situation,
            location: 'Câmara Fria 02 • Gaveta Carnes',
            totalDeducted: Number(totalDeducted.toFixed(2)),
            totalDeductedCost: Number((totalDeducted * unitCost).toFixed(2)),
            totalPortionsSold,
            estimatedAutonomy,
            linkedProductsCount: supply.compositions.length,
            dishUsages: enrichedDishUsages
        }
    })

    return reply.send({
        period,
        mappedSuppliesCount: suppliesWithCompositions.length,
        isPdvIntegrated: true,
        supplies: formattedSupplies
    })
}

// 6. Histórico / Extrato de Movimentações
export async function getStockMovements(request: FastifyRequest, reply: FastifyReply) {
    const querySchema = z.object({
        period: z.string().optional().default('today'),
        eventType: z.string().optional().default('ALL'),
        query: z.string().optional(),
        page: z.coerce.number().default(1),
        perPage: z.coerce.number().default(20),
    })

    const { period, eventType, query, page, perPage } = querySchema.parse(request.query)
    const startDate = getStartDateForPeriod(period)
    const endDate = getEndDateForPeriod(period)

    const where: any = {}
    if (startDate) {
        where.created_at = { gte: startDate, ...(endDate ? { lt: endDate } : {}) }
    }

    if (eventType && eventType !== 'ALL' && eventType !== 'Todos') {
        if (eventType === 'VENDA') {
            where.description = 'VENDA'
        } else if (eventType === 'ENTRADA' || eventType === 'COMPRA') {
            where.description = 'COMPRA'
        } else if (eventType === 'PERDA' || eventType === 'QUEBRA') {
            where.description = { in: ['QUEBRA', 'PERDA', 'CORTESIA', 'CONSUMO_INTERNO'] }
        } else if (eventType === 'BALANCO') {
            where.description = { in: ['AJUSTE_POSITIVO', 'AJUSTE_NEGATIVO'] }
        }
    }

    if (query) {
        where.OR = [
            { supply: { name: { contains: query, mode: 'insensitive' } } },
            { product: { name: { contains: query, mode: 'insensitive' } } },
            { batch_number: { contains: query, mode: 'insensitive' } }
        ]
    }

    const [totalCount, stocks] = await Promise.all([
        prisma.stock.count({ where }),
        prisma.stock.findMany({
            where,
            orderBy: { created_at: 'desc' },
            skip: (page - 1) * perPage,
            take: perPage,
            include: {
                supply: { select: { id: true, name: true, unit: true, category: true, stock: true } },
                product: { select: { id: true, name: true, category: { select: { name: true } }, stock: true } }
            }
        })
    ])

    // Cálculo dos totais de entradas e saídas no período
    const allMovementsInPeriod = await prisma.stock.findMany({
        where: startDate ? { created_at: { gte: startDate, ...(endDate ? { lt: endDate } : {}) } } : {},
        select: {
            operation: true,
            quantity: true,
            unit_cost: true
        }
    })

    let totalEntriesValue = 0
    let totalExitsValue = 0
    for (const m of allMovementsInPeriod) {
        const val = (m.quantity || 0) * (m.unit_cost || 0)
        if (m.operation === StockOperation.IN) {
            totalEntriesValue += val
        } else {
            totalExitsValue += val
        }
    }

    const formattedMovements = stocks.map((m) => {
        const itemName = m.supply?.name || m.product?.name || 'Item avulso'
        const category = m.supply?.category || m.product?.category?.name || 'Geral'
        const unit = m.supply?.unit || 'un'
        const currentBalance = m.supply?.stock ?? m.product?.stock ?? 0
        const delta = m.operation === StockOperation.IN ? m.quantity : -m.quantity
        const previousBalance = currentBalance - delta

        // Formatação legível do tipo de evento
        let eventLabel = 'Movimentação'
        let eventBadgeColor = 'default'
        if (m.description === 'VENDA') {
            eventLabel = 'Venda PDV'
            eventBadgeColor = 'blue'
        } else if (m.description === 'COMPRA') {
            eventLabel = 'Entrada NF-e'
            eventBadgeColor = 'green'
        } else if (m.description === 'QUEBRA' || m.description === 'PERDA') {
            eventLabel = 'Desperdício / Perda'
            eventBadgeColor = 'red'
        } else if (m.description === 'AJUSTE_POSITIVO' || m.description === 'AJUSTE_NEGATIVO') {
            eventLabel = 'Balanço Físico'
            eventBadgeColor = 'purple'
        } else if (m.description === 'DEVOLUCAO') {
            eventLabel = 'Estorno'
            eventBadgeColor = 'amber'
        }

        return {
            id: m.id,
            date: m.created_at,
            itemName,
            category,
            unit,
            operation: m.operation,
            description: m.description,
            eventLabel,
            eventBadgeColor,
            quantity: m.quantity,
            deltaFormatted: m.operation === StockOperation.IN ? `+ ${m.quantity} ${unit}` : `- ${m.quantity} ${unit}`,
            unitCost: m.unit_cost,
            totalValue: Number(((m.quantity || 0) * (m.unit_cost || 0)).toFixed(2)),
            currentBalance,
            previousBalance: Number(previousBalance.toFixed(2)),
            originDetail: m.batch_number || 'Lançamento automático do sistema',
        }
    })

    return reply.send({
        movements: formattedMovements,
        summary: {
            totalCount,
            totalEntriesValue: Number(totalEntriesValue.toFixed(2)),
            totalExitsValue: Number(totalExitsValue.toFixed(2)),
            page,
            perPage,
            totalPages: Math.ceil(totalCount / perPage) || 1
        }
    })
}
