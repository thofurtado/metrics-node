import { describe, it, expect, beforeEach } from 'vitest'

interface Supply {
    id: string
    name: string
    cost: number
    stock: number
    unit: string
}

interface Composition {
    supply_id: string
    quantity: number
}

interface Product {
    id: string
    name: string
    price: number
    cost: number
    is_composite: boolean
    compositions: Composition[]
}

interface ComplementOption {
    id: string
    name: string
    price: number
    linked_supply_id?: string
}

class InMemoryStockAndRecipeService {
    public supplies: Map<string, Supply> = new Map()
    public products: Map<string, Product> = new Map()
    public stockMovements: Array<{ supply_id: string; quantity: number; operation: 'IN' | 'OUT'; reason: string }> = []

    createSupply(data: Omit<Supply, 'id'>): Supply {
        const id = `sup-${Date.now()}-${Math.random()}`
        const supply: Supply = { id, ...data }
        this.supplies.set(id, supply)
        return supply
    }

    createProduct(data: Omit<Product, 'id' | 'cost'>): Product {
        const id = `prod-${Date.now()}-${Math.random()}`
        
        // Calcula o custo automático com base na ficha técnica (CMV)
        let calculatedCost = 0
        for (const comp of data.compositions) {
            const supply = this.supplies.get(comp.supply_id)
            if (supply) {
                calculatedCost += supply.cost * comp.quantity
            }
        }

        const product: Product = {
            id,
            ...data,
            cost: Number(calculatedCost.toFixed(2))
        }
        this.products.set(id, product)
        return product
    }

    processSaleDeduction(saleItem: {
        product_id: string
        quantity: number
        fractions?: Array<{ product_id: string; fraction: number }>
        selectedOptions?: Array<ComplementOption>
    }) {
        // Se for venda fracionada (ex: 1/2 calabresa + 1/2 4 queijos)
        if (saleItem.fractions && saleItem.fractions.length > 0) {
            for (const frac of saleItem.fractions) {
                const prod = this.products.get(frac.product_id)
                if (!prod) continue

                for (const comp of prod.compositions) {
                    const deductionQty = comp.quantity * frac.fraction * saleItem.quantity
                    this.deductSupply(comp.supply_id, deductionQty, `Venda Fracionada (${frac.fraction}) de ${prod.name}`)
                }
            }
        } else {
            // Venda de produto inteiro
            const prod = this.products.get(saleItem.product_id)
            if (prod && prod.is_composite) {
                for (const comp of prod.compositions) {
                    const deductionQty = comp.quantity * saleItem.quantity
                    this.deductSupply(comp.supply_id, deductionQty, `Venda de ${prod.name}`)
                }
            }
        }

        // Baixa de adicionais vinculados a insumos (ex: borda de catupiry)
        if (saleItem.selectedOptions) {
            for (const opt of saleItem.selectedOptions) {
                if (opt.linked_supply_id) {
                    this.deductSupply(opt.linked_supply_id, 1 * saleItem.quantity, `Adicional: ${opt.name}`)
                }
            }
        }
    }

    private deductSupply(supplyId: string, quantity: number, reason: string) {
        const supply = this.supplies.get(supplyId)
        if (!supply) return

        supply.stock -= quantity
        this.stockMovements.push({
            supply_id: supplyId,
            quantity,
            operation: 'OUT',
            reason
        })
    }
}

describe('Recipe, CMV & Automatic Stock Deduction Use Cases', () => {
    let service: InMemoryStockAndRecipeService
    let supMucarela: Supply
    let supCalabresa: Supply
    let supGorgonzola: Supply
    let supPaoBrioche: Supply
    let supBlendBovino: Supply
    let supBordaCatupiry: Supply

    beforeEach(() => {
        service = new InMemoryStockAndRecipeService()

        supMucarela = service.createSupply({ name: 'Muçarela Especial', cost: 30.00, stock: 50.0, unit: 'KG' })
        supCalabresa = service.createSupply({ name: 'Calabresa Fatiada', cost: 25.00, stock: 40.0, unit: 'KG' })
        supGorgonzola = service.createSupply({ name: 'Gorgonzola', cost: 60.00, stock: 10.0, unit: 'KG' })
        supPaoBrioche = service.createSupply({ name: 'Pão Brioche', cost: 2.00, stock: 100.0, unit: 'UN' })
        supBlendBovino = service.createSupply({ name: 'Blend 180g', cost: 7.00, stock: 80.0, unit: 'UN' })
        supBordaCatupiry = service.createSupply({ name: 'Bisnaga Catupiry Borda', cost: 3.50, stock: 50.0, unit: 'UN' })
    })

    it('deve calcular o CMV automaticamente a partir dos insumos da Ficha Técnica', () => {
        // Pizza Calabresa: 0.35kg muçarela (R$ 10,50) + 0.30kg calabresa (R$ 7,50) = R$ 18,00 custo
        const pizzaCalabresa = service.createProduct({
            name: 'Pizza Calabresa',
            price: 60.00,
            is_composite: true,
            compositions: [
                { supply_id: supMucarela.id, quantity: 0.35 },
                { supply_id: supCalabresa.id, quantity: 0.30 },
            ]
        })

        expect(pizzaCalabresa.cost).toBe(18.00)
        // Margem Bruta: (60 - 18) / 60 = 70%
        const margemBruta = (pizzaCalabresa.price - pizzaCalabresa.cost) / pizzaCalabresa.price
        expect(margemBruta).toBeCloseTo(0.70, 2)
    })

    it('deve baixar o estoque proporcional dos insumos na venda de 2 produtos compostos', () => {
        const burger = service.createProduct({
            name: 'Classic Burger',
            price: 35.00,
            is_composite: true,
            compositions: [
                { supply_id: supPaoBrioche.id, quantity: 1.0 },
                { supply_id: supBlendBovino.id, quantity: 1.0 },
            ]
        })

        // Venda de 2 Burgers
        service.processSaleDeduction({
            product_id: burger.id,
            quantity: 2
        })

        // Pão: 100 - 2 = 98
        expect(service.supplies.get(supPaoBrioche.id)!.stock).toBe(98.0)
        // Blend: 80 - 2 = 78
        expect(service.supplies.get(supBlendBovino.id)!.stock).toBe(78.0)
        expect(service.stockMovements).toHaveLength(2)
    })

    it('deve realizar baixa de estoque fracionada proporcional (50% de cada sabor) em Pizza Meio-a-Meio', () => {
        const pizzaCalabresa = service.createProduct({
            name: 'Pizza Calabresa',
            price: 60.00,
            is_composite: true,
            compositions: [
                { supply_id: supMucarela.id, quantity: 0.40 },
                { supply_id: supCalabresa.id, quantity: 0.30 },
            ]
        })

        const pizzaGorgonzola = service.createProduct({
            name: 'Pizza Gorgonzola',
            price: 70.00,
            is_composite: true,
            compositions: [
                { supply_id: supMucarela.id, quantity: 0.20 },
                { supply_id: supGorgonzola.id, quantity: 0.20 },
            ]
        })

        // Venda de 1 Pizza 1/2 Calabresa + 1/2 Gorgonzola
        service.processSaleDeduction({
            product_id: pizzaCalabresa.id,
            quantity: 1,
            fractions: [
                { product_id: pizzaCalabresa.id, fraction: 0.5 },
                { product_id: pizzaGorgonzola.id, fraction: 0.5 }
            ]
        })

        // Muçarela esperada: 50.0 - (0.40 * 0.5 + 0.20 * 0.5) = 50.0 - 0.30 = 49.70
        expect(service.supplies.get(supMucarela.id)!.stock).toBeCloseTo(49.70, 2)

        // Calabresa esperada: 40.0 - (0.30 * 0.5) = 39.85
        expect(service.supplies.get(supCalabresa.id)!.stock).toBeCloseTo(39.85, 2)

        // Gorgonzola esperada: 10.0 - (0.20 * 0.5) = 9.90
        expect(service.supplies.get(supGorgonzola.id)!.stock).toBeCloseTo(9.90, 2)
    })

    it('deve baixar o insumo do adicional vinculado ao pedido', () => {
        const pizza = service.createProduct({
            name: 'Pizza Simples',
            price: 50.00,
            is_composite: true,
            compositions: [{ supply_id: supMucarela.id, quantity: 0.30 }]
        })

        const optBordaCatupiry: ComplementOption = {
            id: 'opt-borda-1',
            name: 'Borda Recheada Catupiry',
            price: 8.00,
            linked_supply_id: supBordaCatupiry.id
        }

        // Venda de 1 pizza com borda de catupiry
        service.processSaleDeduction({
            product_id: pizza.id,
            quantity: 1,
            selectedOptions: [optBordaCatupiry]
        })

        // Muçarela baixada
        expect(service.supplies.get(supMucarela.id)!.stock).toBe(49.70)
        // Borda de catupiry baixada: 50 - 1 = 49
        expect(service.supplies.get(supBordaCatupiry.id)!.stock).toBe(49.0)
    })
})
