import { FastifyRequest, FastifyReply } from 'fastify'
import { requestContext } from '@fastify/request-context'
import { z } from 'zod'
import { lerIntegracao, PROVEDOR_FOOD99 } from '@/modules/system-config/services/tenant-integrations'
import { food99Api } from '../../services/food99-api.service'
import { chaveDoItem99, sugerirProduto } from '../../services/food99-vinculos'

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
        // Item da 99 sem app_item_id (12/10/2026): o nome que está no cardápio da 99, quando ainda não chegou em pedido
        external_name: z.string().max(200).optional(),
    })
    const { platform, external_code, product_id, external_name: nomeInformado } = bodySchema.parse(request.body)

    const product = await prisma.product.findUnique({ where: { id: product_id } })
    if (!product) {
        return reply.status(404).send({ message: 'Produto não encontrado.' })
    }

    // Guarda o nome que o item tem NA PLATAFORMA (o que veio no pedido), nao o nome do produto do Metrics.
    const seen = await prisma.pedidoItem.findFirst({
        where: { external_code, pedido: { plataforma: platform } },
        orderBy: { id: 'desc' },
        select: { external_name: true },
    })
    const external_name = seen?.external_name || nomeInformado?.trim() || null

    const mapping = await prisma.deliveryItemMapping.upsert({
        where: { platform_external_code: { platform, external_code } },
        update: { product_id, ...(external_name ? { external_name } : {}) },
        create: { platform, external_code, product_id, external_name },
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

/**
 * Cardápio da loja na 99Food com o vínculo de cada item (aba 99Food da tela Vínculos com Delivery, 12/10/2026): lê os itens que
 * a loja tem de fato na 99 (só leitura), junta com os vínculos já feitos e sugere o produto pelo nome para os que faltam.
 */
export async function getFood99MenuMappings(request: FastifyRequest, reply: FastifyReply) {
    const prisma = getTenantPrisma(request)
    const integracao = await lerIntegracao(prisma, PROVEDOR_FOOD99).catch(() => null)
    const shopId = String((integracao?.settings as any)?.shopId ?? '').trim()
    if (!shopId) return reply.status(409).send({ message: 'A loja ainda não está ligada à 99Food (Configurações > Integrações > 99Food).' })

    const lista = await food99Api.listMenu(shopId)
    if (!lista.ok) return reply.status(502).send({ message: `A 99 não devolveu o cardápio da loja (${lista.errmsg || 'sem resposta'}).` })

    const [vinculos, produtos] = await Promise.all([
        prisma.deliveryItemMapping.findMany({ where: { platform: '99FOOD' }, include: { product: { select: { id: true, name: true, display_id: true } } } }),
        prisma.product.findMany({ where: { active: true }, select: { id: true, name: true, display_id: true } }),
    ])
    const porCodigo = new Map<string, any>(vinculos.map((v: any) => [v.external_code, v]))

    // O mesmo item pode estar em duas categorias da 99 (na Katatau: "Muçarella Fatiada - 100 G" duas vezes): no pedido o nome é
    // o mesmo, então é um vínculo só e aparece uma vez.
    const vistos = new Set<string>()
    const items = lista.items.filter((it: any) => {
        const chave = chaveDoItem99(it.app_item_id, it.item_name)
        if (!chave || vistos.has(chave)) return false
        vistos.add(chave)
        return true
    }).map((it: any) => {
        const external_code = chaveDoItem99(it.app_item_id, it.item_name)
        const v = porCodigo.get(external_code)
        const sugestao = v ? null : sugerirProduto(it.item_name, produtos)
        return {
            external_code,
            item_name: it.item_name,
            price: Number(it.price || 0) / 100,
            mapping: v ? { id: v.id, product: v.product } : null,
            suggestion: sugestao,
        }
    })
    return reply.status(200).send({ shopId, items })
}

/** Vários vínculos de uma vez ("Confirmar todas as sugestões" da aba 99Food). Mesma regra do vínculo de um item. */
export async function createDeliveryItemMappingsBulk(request: FastifyRequest, reply: FastifyReply) {
    const prisma = getTenantPrisma(request)
    const bodySchema = z.object({
        platform: z.enum(PLATFORMS),
        items: z.array(z.object({ external_code: z.string().min(1), product_id: z.string().uuid(), external_name: z.string().max(200).optional() })).min(1).max(500),
    })
    const { platform, items } = bodySchema.parse(request.body)
    const ids = [...new Set(items.map(i => i.product_id))]
    const existentes = new Set((await prisma.product.findMany({ where: { id: { in: ids } }, select: { id: true } })).map((p: any) => p.id))
    let vinculados = 0
    let corrigidos = 0
    for (const i of items) {
        if (!existentes.has(i.product_id)) continue
        await prisma.deliveryItemMapping.upsert({
            where: { platform_external_code: { platform, external_code: i.external_code } },
            update: { product_id: i.product_id, ...(i.external_name ? { external_name: i.external_name } : {}) },
            create: { platform, external_code: i.external_code, product_id: i.product_id, external_name: i.external_name || null },
        })
        const fixed = await prisma.pedidoItem.updateMany({
            where: { external_code: i.external_code, produto_id: null, pedido: { plataforma: platform } },
            data: { produto_id: i.product_id },
        })
        vinculados++
        corrigidos += fixed.count
    }
    return reply.status(200).send({ linked: vinculados, fixedOrders: corrigidos })
}
