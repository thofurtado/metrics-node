import { describe, it, expect } from 'vitest'

interface ComplementOption {
    id: string
    name: string
    price: number
}

interface ComplementGroup {
    id: string
    name: string
    min_quantity: number
    max_quantity: number
    free_quantity: number
    options: ComplementOption[]
}

interface SelectedOptionQuantity {
    option: ComplementOption
    quantity: number
}

function calculateCustomizedPrice(
    basePrice: number,
    fractions: Array<{ price: number; fraction: number }>,
    groupSelections: Map<string, { group: ComplementGroup; selections: SelectedOptionQuantity[] }>
): { unitPrice: number; displayName: string; isValid: boolean; error?: string } {
    let effectiveBasePrice = basePrice

    // 1. Regra de Maior Preço em Frações
    if (fractions && fractions.length > 0) {
        effectiveBasePrice = Math.max(...fractions.map(f => f.price))
    }

    let complementsTotal = 0

    // 2. Validação e Cálculo de Grupos de Adicionais
    for (const [_, { group, selections }] of groupSelections.entries()) {
        const totalItemsInGroup = selections.reduce((acc, s) => acc + s.quantity, 0)

        // Validação de Mínimo Obrigatório
        if (totalItemsInGroup < group.min_quantity) {
            return {
                unitPrice: 0,
                displayName: '',
                isValid: false,
                error: `O grupo "${group.name}" requer no mínimo ${group.min_quantity} item(ns).`
            }
        }

        // Validação de Limite Máximo
        if (totalItemsInGroup > group.max_quantity) {
            return {
                unitPrice: 0,
                displayName: '',
                isValid: false,
                error: `O grupo "${group.name}" permite no máximo ${group.max_quantity} item(ns).`
            }
        }

        // Cálculo de Cota Gratuita estilo iFood
        let remainingFree = group.free_quantity
        for (const s of selections) {
            let payableQty = s.quantity
            if (remainingFree > 0) {
                const freeCount = Math.min(payableQty, remainingFree)
                payableQty -= freeCount
                remainingFree -= freeCount
            }
            complementsTotal += payableQty * s.option.price
        }
    }

    return {
        unitPrice: effectiveBasePrice + complementsTotal,
        displayName: 'Item Personalizado',
        isValid: true
    }
}

describe('Complements & Fractions Commercial Rules Use Cases', () => {
    it('deve aplicar a regra comercial do Maior Preço para Pizza 1/2 e 1/2', () => {
        const pizzaCalabresa = { name: 'Calabresa', price: 60.00 }
        const pizzaCamarao = { name: 'Camarão Nobre', price: 90.00 }

        const result = calculateCustomizedPrice(
            pizzaCalabresa.price,
            [
                { price: pizzaCalabresa.price, fraction: 0.5 },
                { price: pizzaCamarao.price, fraction: 0.5 }
            ],
            new Map()
        )

        expect(result.isValid).toBe(true)
        // Maior preço entre 60 e 90 é 90
        expect(result.unitPrice).toBe(90.00)
    })

    it('deve bloquear a personalização se um grupo obrigatório (min > 0) não for preenchido', () => {
        const grpPontoCarne: ComplementGroup = {
            id: 'grp-ponto',
            name: 'Ponto da Carne',
            min_quantity: 1,
            max_quantity: 1,
            free_quantity: 1,
            options: [{ id: 'opt-1', name: 'Ao Ponto', price: 0 }]
        }

        const groupSelections = new Map<string, { group: ComplementGroup; selections: SelectedOptionQuantity[] }>()
        // Nenhuma seleção feita
        groupSelections.set('grp-ponto', { group: grpPontoCarne, selections: [] })

        const result = calculateCustomizedPrice(35.00, [], groupSelections)

        expect(result.isValid).toBe(false)
        expect(result.error).toContain('Ponto da Carne')
        expect(result.error).toContain('no mínimo 1')
    })

    it('deve aplicar cota gratuita de adicionais (ex: 1 molho grátis incluso e cobrar apenas o excedente)', () => {
        const grpMolhos: ComplementGroup = {
            id: 'grp-molhos',
            name: 'Molhos da Casa',
            min_quantity: 0,
            max_quantity: 3,
            free_quantity: 1, // 1 molho grátis!
            options: [
                { id: 'opt-maionese', name: 'Maionese Verde', price: 4.00 },
                { id: 'opt-barbecue', name: 'Molho Barbecue', price: 4.00 },
            ]
        }

        const groupSelections = new Map<string, { group: ComplementGroup; selections: SelectedOptionQuantity[] }>()
        // Usuário escolheu 1 Maionese Verde + 1 Molho Barbecue (Total: 2 molhos)
        groupSelections.set('grp-molhos', {
            group: grpMolhos,
            selections: [
                { option: grpMolhos.options[0], quantity: 1 },
                { option: grpMolhos.options[1], quantity: 1 }
            ]
        })

        const result = calculateCustomizedPrice(35.00, [], groupSelections)

        expect(result.isValid).toBe(true)
        // Burger R$ 35,00 + 1 molho pago (R$ 4,00) - pois o 1º molho foi grátis = R$ 39,00
        expect(result.unitPrice).toBe(39.00)
    })
})
