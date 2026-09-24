import { FastifyRequest, FastifyReply } from 'fastify'
import { prisma } from '@/lib/prisma'
import { optionUnitCost, productEffectiveCost, type CostOption, type CostProduct } from '../../services/item-cost'

/**
 * Custos vigentes para o PDV congelar em cada venda (B0-01).
 * Fica no grupo autenticado do PDV (x-api-key) e NÃO no cardápio público: o custo é dado interno do cliente.
 *  - products: custo efetivo (soma da ficha no produto composto; senão o custo cadastrado)
 *  - options: custo de uma unidade da opção de complemento (insumo ou produto ligado × quantidade consumida)
 */
export async function getCostsSync(_request: FastifyRequest, reply: FastifyReply) {
    const products = await prisma.product.findMany({
        select: {
            id: true,
            cost: true,
            is_composite: true,
            compositions: { select: { quantity: true, supply: { select: { cost: true } } } },
        },
    })

    const productById = new Map<string, CostProduct>(
        products.map((p) => [
            p.id,
            {
                id: p.id,
                cost: p.cost ?? null,
                is_composite: p.is_composite,
                compositions: p.compositions.map((c) => ({ quantity: c.quantity, supply: { cost: c.supply?.cost ?? null } })),
            },
        ]),
    )

    const options = await prisma.complementOption.findMany({
        select: { id: true, linked_supply_id: true, linked_product_id: true, supply_quantity: true },
    })

    const supplyIds = [...new Set(options.map((o) => o.linked_supply_id).filter((id): id is string => Boolean(id)))]
    const supplies = supplyIds.length > 0 ? await prisma.supply.findMany({ where: { id: { in: supplyIds } }, select: { id: true, cost: true } }) : []
    const supplyById = new Map(supplies.map((s) => [s.id, { cost: s.cost }]))

    return reply.status(200).send({
        generated_at: new Date().toISOString(),
        products: [...productById.values()].map((p) => ({ id: p.id, cost: productEffectiveCost(p) })),
        options: options.map((o) => {
            const option: CostOption = {
                id: o.id,
                linked_supply_id: o.linked_supply_id,
                linked_product_id: o.linked_product_id,
                supply_quantity: o.supply_quantity,
                supply: o.linked_supply_id ? supplyById.get(o.linked_supply_id) ?? null : null,
                product: o.linked_product_id ? productById.get(o.linked_product_id) ?? null : null,
            }
            return { id: o.id, cost: optionUnitCost(option) }
        }),
    })
}
