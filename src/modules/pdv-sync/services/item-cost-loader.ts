import type { Prisma } from '@prisma/client'
import {
    computeItemCost,
    type ComplementInput,
    type CostOption,
    type CostProduct,
    type FractionInput,
    type ItemCostResult,
} from './item-cost'

type Tx = Prisma.TransactionClient

export interface SaleItemCostPayload {
    ProductId?: string | null
    UnitCost?: number | null
    ComplementsCost?: number | null
    Fractions?: { ProductId: string; Fraction: number; Cost?: number | null }[]
    Complements?: {
        OptionId?: string | null
        LinkedSupplyId?: string | null
        Name?: string | null
        Quantity?: number
        Cost?: number | null
    }[]
}

const productWithComposition = { compositions: { include: { supply: true } } } as const

function toCostProduct(p: any): CostProduct {
    return {
        id: p.id,
        cost: p.cost ?? null,
        is_composite: Boolean(p.is_composite),
        compositions: (p.compositions ?? []).map((c: any) => ({
            quantity: c.quantity,
            supply: { cost: c.supply?.cost ?? null },
        })),
    }
}

/**
 * Monta o custo congelado do item usando o que o PDV mandou e completando com o cadastro do backend.
 * Só faz leituras; a gravação fica com quem chama.
 */
export async function buildItemCost(tx: Tx, item: SaleItemCostPayload): Promise<ItemCostResult> {
    // Produto do item
    let product: CostProduct | null = null
    if (item.ProductId) {
        const p = await tx.product.findUnique({ where: { id: item.ProductId }, include: productWithComposition })
        if (p) product = toCostProduct(p)
    }

    // Sabores do meio a meio
    const fractions: FractionInput[] = []
    for (const f of item.Fractions ?? []) {
        const fp = await tx.product.findUnique({ where: { id: f.ProductId }, include: productWithComposition })
        fractions.push({
            product_id: f.ProductId,
            fraction: f.Fraction,
            product: fp ? toCostProduct(fp) : null,
            cost_from_pdv: f.Cost ?? null,
        })
    }

    // Complementos: opções cadastradas + insumo/produto ligado a cada uma
    const optionIds = (item.Complements ?? []).map((c) => c.OptionId).filter((id): id is string => Boolean(id))
    const options = optionIds.length > 0 ? await tx.complementOption.findMany({ where: { id: { in: optionIds } } }) : []

    const supplyIds = new Set<string>()
    const productIds = new Set<string>()
    for (const o of options) {
        if (o.linked_supply_id) supplyIds.add(o.linked_supply_id)
        if (o.linked_product_id) productIds.add(o.linked_product_id)
    }
    for (const c of item.Complements ?? []) if (c.LinkedSupplyId) supplyIds.add(c.LinkedSupplyId)

    const supplies = supplyIds.size > 0 ? await tx.supply.findMany({ where: { id: { in: [...supplyIds] } } }) : []
    const linkedProducts = productIds.size > 0
        ? await tx.product.findMany({ where: { id: { in: [...productIds] } }, include: productWithComposition })
        : []

    const supplyById = new Map(supplies.map((s) => [s.id, { cost: s.cost }]))
    const productById = new Map(linkedProducts.map((p) => [p.id, toCostProduct(p)]))

    const optionById = new Map<string, CostOption>(
        options.map((o) => [
            o.id,
            {
                id: o.id,
                linked_supply_id: o.linked_supply_id,
                linked_product_id: o.linked_product_id,
                supply_quantity: o.supply_quantity,
                supply: o.linked_supply_id ? supplyById.get(o.linked_supply_id) ?? null : null,
                product: o.linked_product_id ? productById.get(o.linked_product_id) ?? null : null,
            },
        ]),
    )

    const complements: ComplementInput[] = (item.Complements ?? []).map((c) => ({
        option_id: c.OptionId ?? null,
        name: c.Name ?? null,
        quantity: c.Quantity && c.Quantity > 0 ? c.Quantity : 1,
        option: c.OptionId ? optionById.get(c.OptionId) ?? null : null,
        linked_supply: c.LinkedSupplyId ? supplyById.get(c.LinkedSupplyId) ?? null : null,
        cost_from_pdv: c.Cost ?? null,
    }))

    return computeItemCost({
        unit_cost_from_pdv: item.UnitCost ?? null,
        complements_cost_from_pdv: item.ComplementsCost ?? null,
        product,
        fractions,
        complements,
    })
}
