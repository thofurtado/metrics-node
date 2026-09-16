import { FastifyRequest, FastifyReply } from 'fastify'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'

export async function postSalesSync(request: FastifyRequest, reply: FastifyReply) {
    const saleSchema = z.array(z.object({
        Uuid: z.string().uuid(),
        CashierSessionId: z.string().uuid().optional().nullable(),
        Origin: z.string().optional().default('PDV'),
        TotalAmount: z.number().min(0),
        Subtotal: z.number().optional().default(0),
        Discount: z.number().optional().default(0),
        ValorCouvert: z.number().optional().default(0),
        ValorServico: z.number().optional().default(0),
        ValorFrete: z.number().optional().default(0),
        ClienteUuid: z.string().uuid().optional().nullable(),
        Status: z.string().default('COMPLETED'),
        CreatedAt: z.string().optional(),
        Payments: z.array(z.object({
            PaymentMethodUuid: z.string().uuid().optional().nullable(),
            Method: z.string(),
            Amount: z.number().min(0),
            PosMachineName: z.string().optional().nullable(),
            ClienteId: z.string().uuid().optional().nullable(),
            ColaboradorId: z.string().uuid().optional().nullable(),
            NomeTitular: z.string().optional().nullable(),
            Parcelas: z.number().optional().default(1),
        })).optional().default([]),
        Items: z.array(z.object({
            Uuid: z.string().uuid(),
            ProductId: z.string().optional().nullable(),
            Quantity: z.number().positive(),
            UnitPrice: z.number().min(0),
            UnitCost: z.number().optional().default(0),
            Discount: z.number().optional().default(0),
            Observation: z.string().optional().nullable(),
            Fractions: z.array(z.object({
                ProductId: z.string(),
                Fraction: z.number().positive().max(1),
            })).optional(),
            Complements: z.array(z.object({
                OptionId: z.string().optional().nullable(),
                LinkedSupplyId: z.string().optional().nullable(),
                Price: z.number().min(0).optional().default(0),
                Name: z.string().optional(),
            })).optional(),
        })),
    }))

    const sales = saleSchema.parse(request.body)

    await prisma.$transaction(async (tx) => {
        for (const sale of sales) {
            // 1. Descobrir ou vincular a sessão de caixa ativa se não veio explicitamente ou se o caixa anterior foi fechado
            let targetSessionId = sale.CashierSessionId
            if (targetSessionId) {
                const session = await tx.cashierSession.findUnique({
                    where: { id: targetSessionId }
                })
                if (!session || session.status !== 'OPEN') {
                    const activeSession = await tx.cashierSession.findFirst({
                        where: { status: 'OPEN' },
                        orderBy: { opened_at: 'desc' }
                    })
                    targetSessionId = activeSession ? activeSession.id : targetSessionId
                }
            } else {
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
            if (sale.Status === 'CANCELLED') {
                // Cancelamento: remove qualquer entrada de caixa que essa venda tenha gerado (venda cancelada não entra no caixa)
                if (targetSessionId) {
                    await tx.cashierEntry.deleteMany({
                        where: {
                            cashier_session_id: targetSessionId,
                            identification: { contains: sale.Uuid.slice(0, 8) }
                        }
                    })
                }
            } else if (targetSessionId && sale.Payments && sale.Payments.length > 0) {
                let payIndex = 0
                for (const pay of sale.Payments) {
                    if (pay.Amount <= 0) continue
                    payIndex++

                    // Identificador único para múltiplos pagamentos
                    const payIdent = sale.Payments.length === 1
                        ? `${sale.Origin || 'PDV'} - Pedido #${sale.Uuid.slice(0, 8)}`
                        : `${sale.Origin || 'PDV'} - Pedido #${sale.Uuid.slice(0, 8)} [${payIndex}/${sale.Payments.length}] (${pay.Method})`

                    const existingEntry = await tx.cashierEntry.findFirst({
                        where: {
                            cashier_session_id: targetSessionId,
                            identification: payIdent
                        }
                    })

                    const targetClientId = pay.ClienteId || sale.ClienteUuid || null
                    const targetEmployeeId = pay.ColaboradorId || null

                    if (!existingEntry) {
                        await tx.cashierEntry.create({
                            data: {
                                cashier_session_id: targetSessionId,
                                origin: sale.Origin || 'PDV',
                                payment_method: pay.Method,
                                amount: pay.Amount,
                                type: 'SALE',
                                identification: payIdent,
                                source: 'PDV',
                                client_id: targetClientId,
                                employee_id: targetEmployeeId,
                                created_at: saleCreatedAt
                            }
                        })
                    }

                    // Venda a Prazo: cria conta a receber (ClientTab)
                    const normMethod = (pay.Method || '').toLowerCase()
                    const isTerm = normMethod.includes('prazo') || normMethod.includes('correntista') || normMethod.includes('fiado')
                    if (isTerm && targetClientId) {
                        const clientExists = await tx.client.findUnique({ where: { id: targetClientId } })
                        if (clientExists) {
                            const existingTab = await tx.clientTab.findFirst({
                                where: {
                                    client_id: targetClientId,
                                    description: { contains: sale.Uuid.slice(0, 8) }
                                }
                            })
                            if (!existingTab) {
                                await tx.clientTab.create({
                                    data: {
                                        client_id: targetClientId,
                                        cashier_session_id: targetSessionId || null,
                                        amount: pay.Amount,
                                        description: `Venda a Prazo - Pedido #${sale.Uuid.slice(0, 8)} (${pay.NomeTitular || 'Cliente'})`,
                                        is_paid: false,
                                        created_at: saleCreatedAt
                                    }
                                })
                            }
                        }
                    }

                    // Venda para Funcionário: cria lançamento em folha / vale (PayrollEntry)
                    const isEmployee = normMethod.includes('funcionario') || normMethod.includes('funcionário') || Boolean(targetEmployeeId)
                    if (isEmployee && targetEmployeeId) {
                        const employeeExists = await tx.employee.findUnique({ where: { id: targetEmployeeId } })
                        if (employeeExists) {
                            const existingVale = await tx.payrollEntry.findFirst({
                                where: {
                                    employee_id: targetEmployeeId,
                                    description: { contains: sale.Uuid.slice(0, 8) }
                                }
                            })
                            if (!existingVale) {
                                await tx.payrollEntry.create({
                                    data: {
                                        employee_id: targetEmployeeId,
                                        type: 'VALE',
                                        amount: pay.Amount,
                                        referenceDate: saleCreatedAt,
                                        description: `Consumo PDV - Pedido #${sale.Uuid.slice(0, 8)} (${pay.NomeTitular || 'Colaborador'})`,
                                        status: 'PENDING'
                                    }
                                })
                            }
                        }
                    }
                }
            }

                        // 4. Processar Itens da Venda e Motor de Baixa de Insumos da Ficha Técnica
            for (const item of sale.Items) {
                const existingItem = await tx.saleItem.findUnique({
                    where: { id: item.Uuid }
                })

                // Valida se o produto existe no banco da nuvem para não violar FK sale_items_product_id_fkey
                let validProductId: string | null = null
                if (item.ProductId) {
                    const prodExists = await tx.product.findUnique({
                        where: { id: item.ProductId },
                        select: { id: true }
                    })
                    if (prodExists) {
                        validProductId = prodExists.id
                    }
                }

                if (!existingItem) {
                    await tx.saleItem.create({
                        data: {
                            id: item.Uuid,
                            sale_id: sale.Uuid,
                            product_id: validProductId,
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

                        // CASO C: Baixa de Insumos dos Adicionais Vinculados (Complements com ficha técnica e quantidade)
                        if (item.Complements && item.Complements.length > 0) {
                            for (const compOpt of item.Complements) {
                                let targetSupplyId = compOpt.LinkedSupplyId
                                let targetQuantity = 1.0

                                if (compOpt.OptionId) {
                                    const dbOpt = await tx.complementOption.findUnique({
                                        where: { id: compOpt.OptionId }
                                    })
                                    if (dbOpt && dbOpt.linked_supply_id) {
                                        targetSupplyId = dbOpt.linked_supply_id
                                        targetQuantity = (dbOpt as any).supply_quantity || 1.0
                                    }
                                }

                                if (targetSupplyId) {
                                    const supply = await tx.supply.findUnique({
                                        where: { id: targetSupplyId }
                                    })

                                    if (supply) {
                                        const deduction = targetQuantity * item.Quantity

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
