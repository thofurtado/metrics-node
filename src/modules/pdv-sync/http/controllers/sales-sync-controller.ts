import { FastifyRequest, FastifyReply } from 'fastify'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'

export async function postSalesSync(request: FastifyRequest, reply: FastifyReply) {
    const saleSchema = z.array(z.object({
        Uuid: z.string().uuid(),
        CashierSessionId: z.string().uuid().optional().nullable(),
        Origin: z.string().optional().default('PDV'),
        TotalAmount: z.number().min(0),
        Discount: z.number().optional().default(0),
        Status: z.string().default('COMPLETED'),
        CreatedAt: z.string().optional(),
        Payments: z.array(z.object({
            Method: z.string(),
            Amount: z.number().min(0),
            PosMachineName: z.string().optional().nullable(),
        })).optional().default([]),
        Items: z.array(z.object({
            Uuid: z.string().uuid(),
            ProductId: z.string().uuid().optional().nullable(),
            Quantity: z.number().positive(),
            UnitPrice: z.number().min(0),
            UnitCost: z.number().optional().default(0),
            Discount: z.number().optional().default(0),
            Observation: z.string().optional().nullable(),
            Fractions: z.array(z.object({
                ProductId: z.string().uuid(),
                Fraction: z.number().positive().max(1),
            })).optional(),
            Complements: z.array(z.object({
                OptionId: z.string().uuid().optional(),
                LinkedSupplyId: z.string().uuid().optional().nullable(),
                Price: z.number().min(0).optional().default(0),
                Name: z.string().optional(),
            })).optional(),
        })),
    }))

    const sales = saleSchema.parse(request.body)

    await prisma.$transaction(async (tx) => {
        for (const sale of sales) {
            // 1. Descobrir ou vincular a sessão de caixa ativa se não veio explicitamente
            let targetSessionId = sale.CashierSessionId
            if (!targetSessionId) {
                const activeSession = await tx.cashierSession.findFirst({
                    where: { status: 'OPEN' },
                    orderBy: { opened_at: 'desc' }
                })
                if (activeSession) {
                    targetSessionId = activeSession.id
                }
            }

            const saleCreatedAt = sale.CreatedAt ? new Date(sale.CreatedAt) : new Date()

            // 2. Upsert da Venda
            await tx.sale.upsert({
                where: { id: sale.Uuid },
                update: {
                    total_amount: sale.TotalAmount,
                    discount: sale.Discount,
                    status: sale.Status,
                    cashier_session_id: targetSessionId || null,
                },
                create: {
                    id: sale.Uuid,
                    total_amount: sale.TotalAmount,
                    discount: sale.Discount,
                    status: sale.Status,
                    cashier_session_id: targetSessionId || null,
                    created_at: saleCreatedAt,
                }
            })

            // 3. Registrar Entradas de Caixa (CashierEntry) para conferência
            if (targetSessionId && sale.Payments && sale.Payments.length > 0) {
                for (const pay of sale.Payments) {
                    if (pay.Amount <= 0) continue

                    // Evita duplicar entry se a venda já tiver sido sincronizada antes
                    const existingEntry = await tx.cashierEntry.findFirst({
                        where: {
                            cashier_session_id: targetSessionId,
                            identification: { contains: sale.Uuid.slice(0, 8) }
                        }
                    })

                    if (!existingEntry) {
                        await tx.cashierEntry.create({
                            data: {
                                cashier_session_id: targetSessionId,
                                origin: sale.Origin || 'PDV',
                                payment_method: pay.Method,
                                amount: pay.Amount,
                                type: 'SALE',
                                identification: `${sale.Origin || 'PDV'} - Pedido #${sale.Uuid.slice(0, 8)}`,
                                created_at: saleCreatedAt
                            }
                        })
                    }
                }
            }

            // 4. Processar Itens da Venda e Motor de Baixa de Insumos da Ficha Técnica
            for (const item of sale.Items) {
                const existingItem = await tx.saleItem.findUnique({
                    where: { id: item.Uuid }
                })

                if (!existingItem) {
                    await tx.saleItem.create({
                        data: {
                            id: item.Uuid,
                            sale_id: sale.Uuid,
                            product_id: item.ProductId || null,
                            quantity: item.Quantity,
                            unit_price: item.UnitPrice,
                            discount: item.Discount,
                        }
                    })

                    if (sale.Status === 'COMPLETED') {
                        // CASO A: Venda Fracionada (Pizza Meio-a-Meio / Frações)
                        if (item.Fractions && item.Fractions.length > 0) {
                            for (const frac of item.Fractions) {
                                const fracProd = await tx.product.findUnique({
                                    where: { id: frac.ProductId },
                                    include: { compositions: { include: { supply: true } } }
                                })

                                if (fracProd && fracProd.compositions.length > 0) {
                                    for (const comp of fracProd.compositions) {
                                        const deduction = comp.quantity * frac.Fraction * item.Quantity

                                        await tx.stock.create({
                                            data: {
                                                supply_id: comp.supply_id,
                                                quantity: deduction,
                                                unit_cost: comp.supply.cost,
                                                operation: 'OUT',
                                                description: 'VENDA',
                                                created_at: saleCreatedAt
                                            }
                                        })

                                        await tx.supply.update({
                                            where: { id: comp.supply_id },
                                            data: { stock: { decrement: deduction } }
                                        })
                                    }
                                }
                            }
                        } 
                        // CASO B: Produto Inteiro (Composto ou Simples)
                        else if (item.ProductId) {
                            const prod = await tx.product.findUnique({
                                where: { id: item.ProductId },
                                include: { compositions: { include: { supply: true } } }
                            })

                            if (prod) {
                                if (prod.is_composite && prod.compositions.length > 0) {
                                    // Baixa proporcional de cada insumo da receita
                                    for (const comp of prod.compositions) {
                                        const deduction = comp.quantity * item.Quantity

                                        await tx.stock.create({
                                            data: {
                                                supply_id: comp.supply_id,
                                                quantity: deduction,
                                                unit_cost: comp.supply.cost,
                                                operation: 'OUT',
                                                description: 'VENDA',
                                                created_at: saleCreatedAt
                                            }
                                        })

                                        await tx.supply.update({
                                            where: { id: comp.supply_id },
                                            data: { stock: { decrement: deduction } }
                                        })
                                    }
                                } else {
                                    // Baixa direta do estoque do produto simples
                                    await tx.stock.create({
                                        data: {
                                            product_id: prod.id,
                                            quantity: item.Quantity,
                                            operation: 'OUT',
                                            description: 'VENDA',
                                            created_at: saleCreatedAt
                                        }
                                    })

                                    await tx.product.update({
                                        where: { id: prod.id },
                                        data: { stock: { decrement: item.Quantity } }
                                    })
                                }
                            }
                        }

                        // CASO C: Baixa de Insumos dos Adicionais Vinculados (Complements)
                        if (item.Complements && item.Complements.length > 0) {
                            for (const compOpt of item.Complements) {
                                if (compOpt.LinkedSupplyId) {
                                    const supply = await tx.supply.findUnique({
                                        where: { id: compOpt.LinkedSupplyId }
                                    })

                                    if (supply) {
                                        const deduction = 1.0 * item.Quantity

                                        await tx.stock.create({
                                            data: {
                                                supply_id: supply.id,
                                                quantity: deduction,
                                                unit_cost: supply.cost,
                                                operation: 'OUT',
                                                description: 'VENDA',
                                                created_at: saleCreatedAt
                                            }
                                        })

                                        await tx.supply.update({
                                            where: { id: supply.id },
                                            data: { stock: { decrement: deduction } }
                                        })
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }
    })

    return reply.status(201).send({ message: 'Vendas e baixas de CMV sincronizadas com sucesso' })
}
