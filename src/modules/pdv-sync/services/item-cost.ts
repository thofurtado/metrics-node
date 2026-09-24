/**
 * Custo congelado do item vendido (B0-01).
 *
 * O PDV manda o custo que conhecia no momento da venda; o backend só calcula o que faltar,
 * e marca a origem em `source`. Tudo aqui é função pura para poder ser testada sem banco.
 *
 * Convenções:
 *  - `unit_cost` é o custo de UMA unidade do produto (inteiro, ou soma ponderada das frações do meio a meio).
 *  - `complements_cost` é o custo dos complementos de UMA unidade do item (cada opção × a quantidade escolhida).
 *  - custo total da linha = (unit_cost + complements_cost) × quantidade do item.
 */

export interface CostSupply {
    cost: number | null
}

export interface CostCompositionLine {
    quantity: number
    supply: CostSupply
}

export interface CostProduct {
    id: string
    cost: number | null
    is_composite: boolean
    compositions: CostCompositionLine[]
}

export interface CostOption {
    id: string
    linked_supply_id: string | null
    linked_product_id: string | null
    supply_quantity: number | null
    supply?: CostSupply | null
    product?: CostProduct | null
}

export interface FractionInput {
    product_id: string
    fraction: number
    product?: CostProduct | null
    cost_from_pdv?: number | null
}

export interface ComplementInput {
    option_id?: string | null
    name?: string | null
    quantity: number
    option?: CostOption | null
    /** Insumo informado direto pelo PDV (LinkedSupplyId), quando a opção não é encontrada. */
    linked_supply?: CostSupply | null
    cost_from_pdv?: number | null
}

export interface ItemCostInput {
    unit_cost_from_pdv?: number | null
    /** Só usado quando o PDV não mandou a lista de complementos (PDV antigo). */
    complements_cost_from_pdv?: number | null
    product?: CostProduct | null
    fractions: FractionInput[]
    complements: ComplementInput[]
}

export interface ItemCostResult {
    unit_cost: number
    complements_cost: number
    source: 'PDV' | 'BACKEND'
    snapshot: {
        version: 1
        fractions: { product_id: string; fraction: number; cost: number }[]
        complements: { option_id: string | null; name: string | null; quantity: number; cost: number; from: 'PDV' | 'BACKEND' | 'NONE' }[]
    }
}

export function round4(value: number): number {
    return Math.round((value + Number.EPSILON) * 10000) / 10000
}

function positive(value: number | null | undefined): number {
    return typeof value === 'number' && Number.isFinite(value) && value > 0 ? value : 0
}

/** Produto composto custa a soma dos insumos da ficha; senão vale o custo cadastrado. */
export function productEffectiveCost(product: CostProduct | null | undefined): number {
    if (!product) return 0
    if (product.is_composite && product.compositions.length > 0) {
        const sum = product.compositions.reduce((acc, line) => acc + positive(line.quantity) * positive(line.supply?.cost), 0)
        if (sum > 0) return round4(sum)
    }
    return round4(positive(product.cost))
}

/** Custo de UMA unidade da opção de complemento: insumo ou produto ligado × quantidade consumida. */
export function optionUnitCost(option: CostOption | null | undefined): number {
    if (!option) return 0
    const qty = option.supply_quantity && option.supply_quantity > 0 ? option.supply_quantity : 1
    if (option.linked_supply_id && option.supply) return round4(positive(option.supply.cost) * qty)
    if (option.linked_product_id && option.product) return round4(productEffectiveCost(option.product) * qty)
    return 0
}

export function computeItemCost(input: ItemCostInput): ItemCostResult {
    let allFromPdv = true

    // 1) Custo do produto (ou das frações do meio a meio)
    const fractionsSnapshot = input.fractions.map((f) => {
        const cost = positive(f.cost_from_pdv) > 0 ? positive(f.cost_from_pdv) : productEffectiveCost(f.product)
        return { product_id: f.product_id, fraction: f.fraction, cost: round4(cost), from_pdv: positive(f.cost_from_pdv) > 0 }
    })

    let unitCost: number
    if (positive(input.unit_cost_from_pdv) > 0) {
        unitCost = positive(input.unit_cost_from_pdv)
    } else if (fractionsSnapshot.length > 0) {
        unitCost = fractionsSnapshot.reduce((acc, f) => acc + f.cost * f.fraction, 0)
        allFromPdv = false
    } else {
        unitCost = productEffectiveCost(input.product)
        allFromPdv = false
    }

    // 2) Custo dos complementos (por unidade do item)
    let complementsCost = 0
    const complementsSnapshot: ItemCostResult['snapshot']['complements'] = []

    if (input.complements.length > 0) {
        for (const c of input.complements) {
            const qty = c.quantity > 0 ? c.quantity : 1
            let cost = 0
            let from: 'PDV' | 'BACKEND' | 'NONE' = 'NONE'

            if (positive(c.cost_from_pdv) > 0) {
                cost = positive(c.cost_from_pdv)
                from = 'PDV'
            } else {
                const fromOption = optionUnitCost(c.option)
                const fromSupply = positive(c.linked_supply?.cost)
                cost = fromOption > 0 ? fromOption : fromSupply
                from = cost > 0 ? 'BACKEND' : 'NONE'
                // Só conta como "custo estimado" quando o backend teve que calcular algo que o PDV não sabia.
                if (from === 'BACKEND') allFromPdv = false
            }

            complementsCost += cost * qty
            complementsSnapshot.push({
                option_id: c.option_id ?? null,
                name: c.name ?? null,
                quantity: qty,
                cost: round4(cost),
                from,
            })
        }
    } else if (positive(input.complements_cost_from_pdv) > 0) {
        complementsCost = positive(input.complements_cost_from_pdv)
    }

    return {
        unit_cost: round4(unitCost),
        complements_cost: round4(complementsCost),
        source: allFromPdv ? 'PDV' : 'BACKEND',
        snapshot: {
            version: 1,
            fractions: fractionsSnapshot.map(({ product_id, fraction, cost }) => ({ product_id, fraction, cost })),
            complements: complementsSnapshot,
        },
    }
}

/** Custo total da linha vendida (todas as unidades). */
export function lineCost(item: { unit_cost: number | null; complements_cost: number | null; quantity: number }): number {
    return round4(((item.unit_cost ?? 0) + (item.complements_cost ?? 0)) * item.quantity)
}
