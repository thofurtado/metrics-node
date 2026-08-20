import { describe, it, expect, beforeEach } from 'vitest'

interface MockSupply {
    id: string
    name: string
    cost: number
    stock: number
}

interface MockProduct {
    id: string
    name: string
    price: number
    stock: number
    is_composite: boolean
    compositions: Array<{ supply_id: string; quantity: number }>
}

interface MockCashierEntry {
    cashier_session_id: string
    origin: string
    payment_method: string
    amount: number
    identification: string
}

interface MockStockMovement {
    product_id?: string
    supply_id?: string
    quantity: number
    operation: 'OUT'
    description: 'VENDA'
}

class InMemoryPdvSyncService {
    public supplies: Map<string, MockSupply> = new Map()
    public products: Map<string, MockProduct> = new Map()
    public sales: Map<string, any> = new Map()
    public cashierEntries: MockCashierEntry[] = []
    public stockMovements: MockStockMovement[] = []
    public activeSessionId: string = 'session-active-123'

    processSalesSync(salesPayload: any[]) {
        for (const sale of salesPayload) {
            // Idempotência
            if (this.sales.has(sale.Uuid)) {
                continue
            }

            this.sales.set(sale.Uuid, sale)

            // Lançar Pagamentos no Caixa
            if (sale.Payments) {
                for (const pay of sale.Payments) {
                    this.cashierEntries.push({
                        cashier_session_id: this.activeSessionId,
                        origin: sale.Origin || 'PDV',
                        payment_method: pay.Method,
                        amount: pay.Amount,
                        identification: `${sale.Origin || 'PDV'} - Pedido #${sale.Uuid.slice(0, 8)}`
                    })
                }
            }

            // Processar Itens e Baixas de Estoque
            for (const item of sale.Items) {
                // Caso A: Fracionamento (Pizza Meio-a-Meio)
                if (item.Fractions && item.Fractions.length > 0) {
                    for (const frac of item.Fractions) {
                        const fracProd = this.products.get(frac.ProductId)
                        if (fracProd && fracProd.compositions) {
                            for (const comp of fracProd.compositions) {
                                const deduction = comp.quantity * frac.Fraction * item.Quantity
                                const sup = this.supplies.get(comp.supply_id)
                                if (sup) {
                                    sup.stock -= deduction
                                    this.stockMovements.push({
                                        supply_id: comp.supply_id,
                                        quantity: deduction,
                                        operation: 'OUT',
                                        description: 'VENDA'
                                    })
                                }
                            }
                        }
                    }
                } 
                // Caso B: Produto Inteiro
                else if (item.ProductId) {
                    const prod = this.products.get(item.ProductId)
                    if (prod) {
                        if (prod.is_composite && prod.compositions) {
                            for (const comp of prod.compositions) {
                                const deduction = comp.quantity * item.Quantity
                                const sup = this.supplies.get(comp.supply_id)
                                if (sup) {
                                    sup.stock -= deduction
                                    this.stockMovements.push({
                                        supply_id: comp.supply_id,
                                        quantity: deduction,
                                        operation: 'OUT',
                                        description: 'VENDA'
                                    })
                                }
                            }
                        } else {
                            prod.stock -= item.Quantity
                            this.stockMovements.push({
                                product_id: prod.id,
                                quantity: item.Quantity,
                                operation: 'OUT',
                                description: 'VENDA'
                            })
                        }
                    }
                }

                // Caso C: Adicionais com Insumo Vinculado
                if (item.Complements) {
                    for (const compOpt of item.Complements) {
                        if (compOpt.LinkedSupplyId) {
                            const sup = this.supplies.get(compOpt.LinkedSupplyId)
                            if (sup) {
                                const deduction = 1.0 * item.Quantity
                                sup.stock -= deduction
                                this.stockMovements.push({
                                    supply_id: sup.id,
                                    quantity: deduction,
                                    operation: 'OUT',
                                    description: 'VENDA'
                                })
                            }
                        }
                    }
                }
            }
        }
    }
}

describe('PDV Reverse Sales Sync & Automatic CMV Deductions', () => {
    let service: InMemoryPdvSyncService

    beforeEach(() => {
        service = new InMemoryPdvSyncService()

        service.supplies.set('sup-mucarela', { id: 'sup-mucarela', name: 'Muçarela', cost: 30.00, stock: 50.0 })
        service.supplies.set('sup-calabresa', { id: 'sup-calabresa', name: 'Calabresa', cost: 25.00, stock: 40.0 })
        service.supplies.set('sup-gorgonzola', { id: 'sup-gorgonzola', name: 'Gorgonzola', cost: 60.00, stock: 10.0 })
        service.supplies.set('sup-borda-catupiry', { id: 'sup-borda-catupiry', name: 'Bisnaga Catupiry', cost: 4.00, stock: 20.0 })

        service.products.set('prod-pizza-calabresa', {
            id: 'prod-pizza-calabresa',
            name: 'Pizza Calabresa',
            price: 60.00,
            stock: 0,
            is_composite: true,
            compositions: [
                { supply_id: 'sup-mucarela', quantity: 0.40 },
                { supply_id: 'sup-calabresa', quantity: 0.30 },
            ]
        })

        service.products.set('prod-pizza-4queijos', {
            id: 'prod-pizza-4queijos',
            name: 'Pizza 4 Queijos',
            price: 70.00,
            stock: 0,
            is_composite: true,
            compositions: [
                { supply_id: 'sup-mucarela', quantity: 0.20 },
                { supply_id: 'sup-gorgonzola', quantity: 0.20 },
            ]
        })

        service.products.set('prod-coca-lata', {
            id: 'prod-coca-lata',
            name: 'Coca-Cola 350ml',
            price: 7.00,
            stock: 100.0,
            is_composite: false,
            compositions: []
        })
    })

    it('deve sincronizar venda simples e composta baixando estoque de insumos e produtos simples', () => {
        const payload = [
            {
                Uuid: 'd9b3d077-e859-4d64-9b2f-76c701bb1234',
                Origin: 'MESA 02',
                TotalAmount: 67.00,
                Discount: 0,
                Status: 'COMPLETED',
                Payments: [
                    { Method: 'PIX', Amount: 67.00 }
                ],
                Items: [
                    {
                        Uuid: 'item-1',
                        ProductId: 'prod-pizza-calabresa',
                        Quantity: 1,
                        UnitPrice: 60.00
                    },
                    {
                        Uuid: 'item-2',
                        ProductId: 'prod-coca-lata',
                        Quantity: 1,
                        UnitPrice: 7.00
                    }
                ]
            }
        ]

        service.processSalesSync(payload)

        expect(service.sales.size).toBe(1)
        expect(service.cashierEntries).toHaveLength(1)
        expect(service.cashierEntries[0].origin).toBe('MESA 02')
        expect(service.cashierEntries[0].payment_method).toBe('PIX')
        expect(service.cashierEntries[0].amount).toBe(67.00)

        // Muçarela: 50.0 - 0.40 = 49.60
        expect(service.supplies.get('sup-mucarela')!.stock).toBeCloseTo(49.60, 2)
        // Calabresa: 40.0 - 0.30 = 39.70
        expect(service.supplies.get('sup-calabresa')!.stock).toBeCloseTo(39.70, 2)
        // Coca-Cola Lata: 100 - 1 = 99
        expect(service.products.get('prod-coca-lata')!.stock).toBe(99.0)
    })

    it('deve sincronizar pizza meio-a-meio com borda recheada baixando frações exatas e insumo da borda', () => {
        const payload = [
            {
                Uuid: 'f2a4b889-1111-2222-3333-444455556666',
                Origin: 'DELIVERY #501',
                TotalAmount: 79.90,
                Status: 'COMPLETED',
                Payments: [
                    { Method: 'CREDIT', Amount: 79.90, PosMachineName: 'Stone' }
                ],
                Items: [
                    {
                        Uuid: 'item-pizza-fracionada',
                        ProductId: 'prod-pizza-4queijos', // Maior preço base
                        Quantity: 1,
                        UnitPrice: 79.90,
                        Fractions: [
                            { ProductId: 'prod-pizza-calabresa', Fraction: 0.5 },
                            { ProductId: 'prod-pizza-4queijos', Fraction: 0.5 }
                        ],
                        Complements: [
                            { OptionId: 'opt-borda', LinkedSupplyId: 'sup-borda-catupiry', Price: 9.90, Name: 'Borda Catupiry' }
                        ]
                    }
                ]
            }
        ]

        service.processSalesSync(payload)

        // Muçarela baixada: 50.0 - (0.40 * 0.5 + 0.20 * 0.5) = 50.0 - 0.30 = 49.70
        expect(service.supplies.get('sup-mucarela')!.stock).toBeCloseTo(49.70, 2)
        // Calabresa baixada: 40.0 - (0.30 * 0.5) = 39.85
        expect(service.supplies.get('sup-calabresa')!.stock).toBeCloseTo(39.85, 2)
        // Gorgonzola baixada: 10.0 - (0.20 * 0.5) = 9.90
        expect(service.supplies.get('sup-gorgonzola')!.stock).toBeCloseTo(9.90, 2)
        // Borda Catupiry baixada: 20.0 - 1 = 19.0
        expect(service.supplies.get('sup-borda-catupiry')!.stock).toBe(19.0)
    })

    it('deve garantir idempotência sem duplicar baixas caso a mesma venda seja reenviada pela rede', () => {
        const payload = [
            {
                Uuid: 'unique-sale-id-1234',
                Origin: 'BALCAO',
                TotalAmount: 14.00,
                Status: 'COMPLETED',
                Payments: [{ Method: 'CASH', Amount: 14.00 }],
                Items: [
                    { Uuid: 'item-coca-2x', ProductId: 'prod-coca-lata', Quantity: 2, UnitPrice: 7.00 }
                ]
            }
        ]

        // 1ª execução
        service.processSalesSync(payload)
        expect(service.products.get('prod-coca-lata')!.stock).toBe(98.0)
        expect(service.cashierEntries).toHaveLength(1)

        // 2ª execução (retry por oscilação de rede)
        service.processSalesSync(payload)
        // Estoque permanece 98.0 (NÃO reduziu para 96.0)
        expect(service.products.get('prod-coca-lata')!.stock).toBe(98.0)
        // Cashier entries permanece 1 (NÃO duplicou)
        expect(service.cashierEntries).toHaveLength(1)
    })
})
