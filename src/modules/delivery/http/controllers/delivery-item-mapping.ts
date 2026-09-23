import { FastifyRequest, FastifyReply } from 'fastify'
import { requestContext } from '@fastify/request-context'
import { z } from 'zod'

/**
 * Vínculo de item de delivery (iFood/99Food) com produto do Metrics.
 *
 * Sem o módulo Catalog do iFood, quem cadastra o cardápio lá é o próprio lojista, direto no
 * painel do iFood — o código que volta em cada item do pedido (`externalCode`) só bate com o
 * nosso produto se alguém digitar manualmente o mesmo código/barcode nos dois lados. Em vez de
 * exigir essa configuração manual antes de vender, deixamos o pedido entrar mesmo sem vínculo e
 * mostramos aqui os itens pendentes: a pessoa vincula uma vez, e todo pedido futuro com aquele
 * mesmo código casa sozinho (e os pedidos passados com esse código são corrigidos junto).
 */

const PLATFORMS = ['IFOOD', '99FOOD'] as const

function getTenantPrisma(request: FastifyRequest): any {
    const prisma = requestContext.get('prisma')
    if (!prisma) {
        throw new Error('Tenant não resolvido para esta requisição.')
    }
    return prisma
}

export async function getPendingDeliveryItemMappings(request: FastifyRequest, reply: FastifyReply) {
    const prisma = getTenantPrisma(request)

    const querySchema = z.object({ platform: z.enum(PLATFORMS).optional() })
    const { platform } = querySchema.parse(request.query)

    const unmatched = await prisma.pedidoItem.findMany({
        where: {
            produto_id: null,
            external_code: { not: null },
            pedido: platform ? { plataforma: platform } : { plataforma: { in: [...PLATFORMS] } },
        },
        select: {
            external_code: true,
            external_name: true,
            pedido: { select: { plataforma: true, data_abertura: true } },
        },
        orderBy: { pedido: { data_abertura: 'desc' } },
    })

    // Um item de cardápio aparece uma vez só, não uma por pedido — junta por (plataforma, código).
    const grouped = new Map<string, { platform: string; external_code: string; external_name: string | null; occurrences: number; last_seen: Date }>()
    for (const item of unmatched) {
        const platformValue = item.pedido?.plataforma || 'IFOOD'
        const key = `${platformValue}|${item.external_code}`
        const existing = grouped.get(key)
        if (existing) {
            existing.occurrences++
            if (item.pedido?.data_abertura && item.pedido.data_abertura > existing.last_seen) {
                existing.last_seen = item.pedido.data_abertura
            }
        } else {
            grouped.set(key, {
                platform: platformValue,
                external_code: item.external_code as string,
                external_name: item.external_name,
                occurrences: 1,
                last_seen: item.pedido?.data_abertura || new Date(),
            })
        }
    }

    return reply.status(200).send({ pending: Array.from(grouped.values()).sort((a, b) => b.last_seen.getTime() - a.last_seen.getTime()) })
}

export async function createDeliveryItemMapping(request: FastifyRequest, reply: FastifyReply) {
    const prisma = getTenantPrisma(request)

    const bodySchema = z.object({
        platform: z.enum(PLATFORMS),
        external_code: z.string().min(1),
        product_id: z.string().uuid(),
    })
    const { platform, external_code, product_id } = bodySchema.parse(request.body)

    const product = await prisma.product.findUnique({ where: { id: product_id } })
    if (!product) {
        return reply.status(404).send({ message: 'Produto não encontrado.' })
    }

    const mapping = await prisma.deliveryItemMapping.upsert({
        where: { platform_external_code: { platform, external_code } },
        update: { product_id },
        create: { platform, external_code, product_id, external_name: product.name },
    })

    // Corrige na hora os pedidos passados que ficaram com esse item sem produto — não precisa
    // esperar o próximo pedido pra ver o vínculo refletido nos relatórios/estoque.
    const fixed = await prisma.pedidoItem.updateMany({
        where: {
            external_code,
            produto_id: null,
            pedido: { plataforma: platform },
        },
        data: { produto_id: product_id },
    })

    return reply.status(200).send({ mapping, fixedOrders: fixed.count })
}

export async function listDeliveryItemMappings(request: FastifyRequest, reply: FastifyReply) {
    const prisma = getTenantPrisma(request)
    const mappings = await prisma.deliveryItemMapping.findMany({
        include: { product: { select: { id: true, name: true } } },
        orderBy: { updated_at: 'desc' },
    })
    return reply.status(200).send({ mappings })
}

export async function deleteDeliveryItemMapping(request: FastifyRequest, reply: FastifyReply) {
    const prisma = getTenantPrisma(request)
    const paramsSchema = z.object({ id: z.string().uuid() })
    const { id } = paramsSchema.parse(request.params)

    await prisma.deliveryItemMapping.delete({ where: { id } })
    return reply.status(204).send()
}
