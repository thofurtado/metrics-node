import { describe, expect, it } from 'vitest'
import {
    computeItemCost,
    lineCost,
    optionUnitCost,
    productEffectiveCost,
    type CostOption,
    type CostProduct,
} from './item-cost'

const simples = (cost: number | null): CostProduct => ({ id: 'p1', cost, is_composite: false, compositions: [] })

const composto = (linhas: [number, number][], cost: number | null = 0): CostProduct => ({
    id: 'pc',
    cost,
    is_composite: true,
    compositions: linhas.map(([quantity, custo]) => ({ quantity, supply: { cost: custo } })),
})

describe('productEffectiveCost', () => {
    it('usa o custo cadastrado no produto simples', () => {
        expect(productEffectiveCost(simples(4.5))).toBe(4.5)
    })

    it('soma os insumos da ficha no produto composto', () => {
        // 0,2 kg a R$ 20 + 2 un a R$ 1,5 = 4 + 3 = 7
        expect(productEffectiveCost(composto([[0.2, 20], [2, 1.5]]))).toBe(7)
    })

    it('cai no custo cadastrado quando o composto não tem ficha com custo', () => {
        expect(productEffectiveCost(composto([[1, 0]], 3))).toBe(3)
    })

    it('devolve 0 para produto ausente ou custo nulo', () => {
        expect(productEffectiveCost(null)).toBe(0)
        expect(productEffectiveCost(simples(null))).toBe(0)
    })
})

describe('optionUnitCost', () => {
    const base: CostOption = { id: 'o', linked_supply_id: null, linked_product_id: null, supply_quantity: null }

    it('custo do insumo ligado × quantidade consumida', () => {
        expect(optionUnitCost({ ...base, linked_supply_id: 's', supply_quantity: 0.05, supply: { cost: 40 } })).toBe(2)
    })

    it('assume quantidade 1 quando não informada', () => {
        expect(optionUnitCost({ ...base, linked_supply_id: 's', supply: { cost: 1.2 } })).toBe(1.2)
    })

    it('usa o custo efetivo do produto ligado', () => {
        expect(optionUnitCost({ ...base, linked_product_id: 'p', product: composto([[1, 3]]) })).toBe(3)
    })

    it('opção sem ligação não tem custo', () => {
        expect(optionUnitCost(base)).toBe(0)
    })
})

describe('computeItemCost', () => {
    it('mantém o custo que o PDV congelou na venda', () => {
        const r = computeItemCost({ unit_cost_from_pdv: 5, product: simples(9), fractions: [], complements: [] })
        expect(r.unit_cost).toBe(5)
        expect(r.source).toBe('PDV')
    })

    it('estima pelo backend quando o PDV mandou custo zero', () => {
        const r = computeItemCost({ unit_cost_from_pdv: 0, product: composto([[0.5, 10]]), fractions: [], complements: [] })
        expect(r.unit_cost).toBe(5)
        expect(r.source).toBe('BACKEND')
    })

    it('meio a meio: custo é a média ponderada dos sabores', () => {
        const r = computeItemCost({
            unit_cost_from_pdv: 0,
            product: simples(0),
            fractions: [
                { product_id: 'a', fraction: 0.5, product: simples(12) },
                { product_id: 'b', fraction: 0.5, product: simples(20) },
            ],
            complements: [],
        })
        expect(r.unit_cost).toBe(16)
        expect(r.snapshot.fractions).toHaveLength(2)
    })

    it('soma o custo dos complementos por quantidade escolhida', () => {
        const r = computeItemCost({
            unit_cost_from_pdv: 10,
            product: simples(10),
            fractions: [],
            complements: [
                { option_id: 'bacon', name: 'Bacon', quantity: 2, cost_from_pdv: 1.5 },
                { option_id: 'cheddar', name: 'Cheddar', quantity: 1, cost_from_pdv: 2 },
            ],
        })
        expect(r.complements_cost).toBe(5) // 2×1,5 + 1×2
        expect(r.source).toBe('PDV')
    })

    it('calcula no backend o complemento que o PDV não sabia', () => {
        const opt: CostOption = { id: 'o1', linked_supply_id: 's', linked_product_id: null, supply_quantity: 0.1, supply: { cost: 30 } }
        const r = computeItemCost({
            unit_cost_from_pdv: 8,
            product: simples(8),
            fractions: [],
            complements: [{ option_id: 'o1', name: 'Molho', quantity: 1, cost_from_pdv: 0, option: opt }],
        })
        expect(r.complements_cost).toBe(3)
        expect(r.source).toBe('BACKEND')
        expect(r.snapshot.complements[0].from).toBe('BACKEND')
    })

    it('complemento sem custo conhecido não estima e não marca como backend', () => {
        const r = computeItemCost({
            unit_cost_from_pdv: 8,
            product: simples(8),
            fractions: [],
            complements: [{ option_id: 'x', name: 'Guardanapo', quantity: 1 }],
        })
        expect(r.complements_cost).toBe(0)
        expect(r.snapshot.complements[0].from).toBe('NONE')
    })

    it('usa o total de complementos do PDV antigo quando não veio a lista', () => {
        const r = computeItemCost({ unit_cost_from_pdv: 4, complements_cost_from_pdv: 2.5, fractions: [], complements: [] })
        expect(r.complements_cost).toBe(2.5)
    })
})

describe('lineCost', () => {
    it('multiplica (produto + complementos) pela quantidade', () => {
        expect(lineCost({ unit_cost: 10, complements_cost: 2, quantity: 3 })).toBe(36)
    })

    it('trata custo nulo como zero', () => {
        expect(lineCost({ unit_cost: null, complements_cost: null, quantity: 2 })).toBe(0)
    })
})
