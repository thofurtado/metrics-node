import { FastifyRequest, FastifyReply } from 'fastify'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'

/**
 * Endpoint de Catálogo Rápido para o App Garçom Móvel (Android / Kotlin)
 * GET /api/garcom/cardapio
 */
export async function getGarcomCardapio(request: FastifyRequest, reply: FastifyReply) {
    const categories = await prisma.category.findMany({
        orderBy: { name: 'asc' },
        select: { id: true, name: true }
    })

    const products = await prisma.product.findMany({
        where: { active: true },
        orderBy: { name: 'asc' },
        include: {
            category: true,
            subcategory: true,
            complementGroups: {
                include: {
                    group: {
                        include: {
                            options: {
                                where: { active: true }
                            }
                        }
                    }
                }
            }
        }
    })

    const setores = categories.map((c, index) => ({
        id: index + 1,
        uuid: c.id,
        nome: c.name
    }))

    const categoryMap = new Map(categories.map((c, idx) => [c.id, idx + 1]))

    const formattedProducts = products.map((p, idx) => {
        const setorId = p.category_id ? (categoryMap.get(p.category_id) || 1) : 1

        const gruposComplementos = p.complementGroups.map((pg: any, gIdx: number) => ({
            id: gIdx + 1,
            uuid: pg.group.id,
            nome: pg.group.name,
            minimo: pg.group.min_quantity,
            maximo: pg.group.max_quantity,
            gratis: pg.group.free_quantity,
            obrigatorio: pg.group.min_quantity > 0,
            opcoes: (pg.group?.options || []).map((opt: any, oIdx: number) => ({
                id: oIdx + 1,
                uuid: opt.id,
                nome: opt.name,
                preco: opt.price
            }))
        }))

        return {
            id: p.display_id || (idx + 1),
            uuid: p.id,
            displayId: p.display_id,
            nome: p.name,
            preco: p.price,
            setorId,
            setorNome: p.category?.name || "Geral",
            imagem: p.image_url,
            gruposComplementos,
            aceitaFracionamento: p.subcategory?.accepts_fractions || false,
            maxFracoes: p.subcategory?.max_fractions || 4
        }
    })

    return reply.status(200).send({
        setores,
        produtos: formattedProducts
    })
}

/**
 * Lista de Mesas e Comandas para o App Garçom Móvel
 * GET /api/garcom/mesas
 */
export async function getGarcomMesas(request: FastifyRequest, reply: FastifyReply) {
    const activeTables = await prisma.activeTable.findMany({
        include: { items: true },
        orderBy: { identifier: 'asc' }
    })

    const totalMesasConfig = 20
    const mesasMap = new Map<string, any>()

    for (let i = 1; i <= totalMesasConfig; i++) {
        const numStr = i < 10 ? `0${i}` : `${i}`
        const ident = `Mesa ${numStr}`
        mesasMap.set(ident, {
            id: i,
            identificador: ident,
            tipo: 'MESA',
            status: 'Livre',
            quantidadePessoas: 0,
            tempoMinutos: 0,
            criadaEm: null,
            totalAcumulado: 0.0,
            quantidadeItens: 0
        })
    }

    const comandas: any[] = []

    for (const t of activeTables) {
        const qtdItens = t.items.reduce((acc, it) => acc + it.quantity, 0)
        const total = Number(t.total_amount || 0)
        const diffMs = Date.now() - new Date(t.opened_at).getTime()
        const tempoMin = Math.max(0, Math.floor(diffMs / 60000))

        const itemDto = {
            id: t.id.slice(0, 8),
            uuid: t.id,
            identificador: t.identifier,
            tipo: t.type,
            status: t.status,
            quantidadePessoas: t.people_count,
            tempoMinutos: tempoMin,
            criadaEm: t.opened_at.toISOString(),
            totalAcumulado: total,
            quantidadeItens: qtdItens
        }

        if (t.type === 'COMANDA') {
            comandas.push(itemDto)
        } else {
            mesasMap.set(t.identifier, itemDto)
        }
    }

    return reply.status(200).send({
        mesas: Array.from(mesasMap.values()),
        comandas
    })
}

/**
 * Detalhes de uma Mesa para o App Garçom Móvel
 * GET /api/garcom/mesas/:id
 */
export async function getGarcomMesaDetalhes(request: FastifyRequest, reply: FastifyReply) {
    const { id } = request.params as { id: string }

    let table = await prisma.activeTable.findFirst({
        where: {
            OR: [
                { id },
                { identifier: id },
                { identifier: `Mesa ${id}` },
                { identifier: `Mesa ${id.padStart(2, '0')}` }
            ]
        },
        include: { items: true }
    })

    if (!table) {
        return reply.status(404).send({ message: 'Mesa não encontrada' })
    }

    const itens = table.items.map((it, idx) => ({
        id: idx + 1,
        uuid: it.id,
        produtoId: 0,
        nome: it.product_name,
        quantidade: it.quantity,
        valorUnitario: Number(it.unit_price),
        valorTotal: Number(it.total_price),
        observacao: it.observation,
        complementosJson: it.complements_json,
        statusCozinha: "Pendente",
        dataLancamento: it.created_at.toISOString()
    }))

    return reply.status(200).send({
        id: table.id,
        identificador: table.identifier,
        tipo: table.type,
        status: table.status,
        quantidadePessoas: table.people_count,
        criadaEm: table.opened_at.toISOString(),
        totalAcumulado: Number(table.total_amount),
        itens
    })
}

/**
 * Abertura de Mesa pelo App Garçom Móvel
 * POST /api/garcom/mesas/abrir
 */
export async function postGarcomAbrirMesa(request: FastifyRequest, reply: FastifyReply) {
    const bodySchema = z.object({
        identificador: z.string(),
        quantidadePessoas: z.number().default(1),
        tipo: z.string().default('MESA')
    })

    const data = bodySchema.parse(request.body)

    let table = await prisma.activeTable.findFirst({
        where: { identifier: data.identificador }
    })

    if (table) {
        table = await prisma.activeTable.update({
            where: { id: table.id },
            data: {
                status: 'Ocupada',
                people_count: data.quantidadePessoas,
                type: data.tipo,
                opened_at: new Date()
            }
        })
    } else {
        table = await prisma.activeTable.create({
            data: {
                identifier: data.identificador,
                type: data.tipo,
                status: 'Ocupada',
                people_count: data.quantidadePessoas,
                total_amount: 0,
                opened_at: new Date()
            }
        })
    }

    return reply.status(201).send({ success: true, table })
}

/**
 * Lançar Itens na Mesa pelo App Garçom Móvel
 * POST /api/garcom/mesas/:mesaId/itens
 */
export async function postGarcomLancarItens(request: FastifyRequest, reply: FastifyReply) {
    const { mesaId } = request.params as { mesaId: string }
    const bodySchema = z.object({
        idempotencyKey: z.string().optional().nullable(),
        garcomNome: z.string().optional().nullable().default('Garçom App'),
        itens: z.array(z.object({
            produtoId: z.number(),
            quantidade: z.number().positive(),
            observacao: z.string().optional().nullable(),
            complementosJson: z.string().optional().nullable(),
            valorUnitario: z.number().optional().nullable()
        }))
    })

    const body = bodySchema.parse(request.body)

    let table = await prisma.activeTable.findFirst({
        where: {
            OR: [
                { id: mesaId },
                { identifier: mesaId },
                { identifier: `Mesa ${mesaId}` },
                { identifier: `Mesa ${mesaId.padStart(2, '0')}` }
            ]
        }
    })

    if (!table) {
        table = await prisma.activeTable.create({
            data: {
                identifier: isNaN(Number(mesaId)) ? mesaId : `Mesa ${mesaId.padStart(2, '0')}`,
                type: 'MESA',
                status: 'Ocupada',
                people_count: 1,
                total_amount: 0,
                opened_at: new Date()
            }
        })
    }

    let adicionadoTotal = 0

    for (const item of body.itens) {
        const prod = await prisma.product.findFirst({
            where: { display_id: item.produtoId }
        })

        const nome = prod ? prod.name : `Produto #${item.produtoId}`
        const unitPrice = item.valorUnitario || (prod ? prod.price : 0)
        const totalPrice = unitPrice * item.quantidade

        adicionadoTotal += totalPrice

        await prisma.activeTableItem.create({
            data: {
                active_table_id: table.id,
                product_id: prod?.id || null,
                product_name: nome,
                quantity: item.quantidade,
                unit_price: unitPrice,
                total_price: totalPrice,
                complements_json: item.complementosJson,
                observation: item.observacao,
                waiter_name: body.garcomNome || "Garçom App"
            }
        })
    }

    await prisma.activeTable.update({
        where: { id: table.id },
        data: {
            status: 'Ocupada',
            total_amount: { increment: adicionadoTotal }
        }
    })

    return reply.status(201).send({ success: true, message: 'Itens lançados com sucesso' })
}

/**
 * Solicitar Fechamento de Conta (Pedir Conta)
 * POST /api/garcom/mesas/:mesaId/pedir-conta
 */
export async function postGarcomPedirConta(request: FastifyRequest, reply: FastifyReply) {
    const { mesaId } = request.params as { mesaId: string }

    const table = await prisma.activeTable.findFirst({
        where: {
            OR: [
                { id: mesaId },
                { identifier: mesaId },
                { identifier: `Mesa ${mesaId}` },
                { identifier: `Mesa ${mesaId.padStart(2, '0')}` }
            ]
        }
    })

    if (table) {
        await prisma.activeTable.update({
            where: { id: table.id },
            data: { status: 'Ociosa' } // No app garçom, Ociosa = Pedindo Conta
        })
    }

    return reply.status(200).send({ success: true, message: 'Conta solicitada com sucesso' })
}
