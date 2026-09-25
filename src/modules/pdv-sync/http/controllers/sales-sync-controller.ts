import { FastifyRequest, FastifyReply } from 'fastify'
import { prisma } from '@/lib/prisma'
import { Prisma } from '@prisma/client'
import { z } from 'zod'
import { buildItemCost } from '../../services/item-cost-loader'
import {
    SyncRejection,
    buildSaleEntries,
    checkSaleSession,
    chooseSaleSessionId,
    isTermPayment,
    saleEntryTag,
    saleFieldsChanged,
    sameEntries,
} from '../../services/cashier-sync-rules'

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
            // Custo dos complementos por unidade do item, somado pelo PDV (usado só se não vier a lista)
            ComplementsCost: z.number().optional().nullable(),
            Discount: z.number().optional().default(0),
            Observation: z.string().optional().nullable(),
            Fractions: z.array(z.object({
                ProductId: z.string(),
                Fraction: z.number().positive().max(1),
                Cost: z.number().optional().nullable(),
            })).optional(),
            Complements: z.array(z.object({
                OptionId: z.string().optional().nullable(),
                LinkedSupplyId: z.string().optional().nullable(),
                Price: z.number().min(0).optional().default(0),
                Name: z.string().optional().nullable(),
                Quantity: z.number().positive().optional().default(1),
                Cost: z.number().optional().nullable(),
            })).optional(),
        })),
    }))

    const sales = saleSchema.parse(request.body)

    try {
        await prisma.$transaction(async (tx) => {
        for (const sale of sales) {
            // 1. Caixa da venda (regras em services/cashier-sync-rules.ts): a nuvem nunca escolhe um caixa por conta própria.
            //    Antes, venda de caixa fechado (ou sem caixa) caía no caixa aberto mais recente de QUALQUER terminal.
            const existingSale = await tx.sale.findUnique({
                where: { id: sale.Uuid },
                select: { cashier_session_id: true, total_amount: true, discount: true, status: true }
            })
            const targetSessionId = chooseSaleSessionId(sale.CashierSessionId, existingSale?.cashier_session_id)
            const session = targetSessionId
                ? await tx.cashierSession.findUnique({ where: { id: targetSessionId }, select: { status: true } })
                : null

            // 2. O que a venda muda: lançamentos (um por pagamento), valores/status e itens novos.
            const desiredEntries = buildSaleEntries(sale.Uuid, sale.Origin, sale.Status, sale.Payments)
            const storedEntries = session && targetSessionId
                ? await tx.cashierEntry.findMany({
                    where: { cashier_session_id: targetSessionId, type: 'SALE', source: 'PDV', identification: { contains: saleEntryTag(sale.Uuid) } },
                    select: { id: true, identification: true, payment_method: true, amount: true }
                })
                : []
            const entriesChanged = !sameEntries(
                storedEntries.map(e => ({ identification: e.identification ?? '', payment_method: e.payment_method, amount: e.amount })),
                desiredEntries,
            )
            const storedItemIds = new Set((await tx.saleItem.findMany({
                where: { id: { in: sale.Items.map(i => i.Uuid) } },
                select: { id: true }
            })).map(i => i.id))
            const hasNewItems = sale.Items.some(i => !storedItemIds.has(i.Uuid))
            const changesSession = !existingSale || saleFieldsChanged(existingSale, sale) || entriesChanged || hasNewItems

            const rejection = checkSaleSession(targetSessionId, session, changesSession)
            if (rejection) throw new SyncRejection(rejection, sale.Uuid)
            if (!changesSession) continue // reenvio idêntico: nada a gravar

            const saleCreatedAt = sale.CreatedAt ? new Date(sale.CreatedAt) : new Date()

            // Pagamentos positivos, na mesma ordem dos lançamentos desejados (cliente e colaborador conferidos antes de gravar)
            const positivePayments = sale.Status === 'CANCELLED' ? [] : sale.Payments.filter(p => p.Amount > 0)
            const paymentLinks: { clientId: string | null; employeeId: string | null }[] = []
            for (const pay of positivePayments) {
                const wantedClientId = pay.ClienteId || sale.ClienteUuid || null
                const clientExists = wantedClientId
                    ? !!(await tx.client.findUnique({ where: { id: wantedClientId }, select: { id: true } }))
                    : false
                // Fiado sem o cliente na nuvem perderia a conta a receber: recusa até o cadastro do cliente subir.
                if (isTermPayment(pay.Method) && wantedClientId && !clientExists) throw new SyncRejection('CLIENTE_NAO_ENVIADO', sale.Uuid)

                const wantedEmployeeId = pay.ColaboradorId || null
                if (wantedEmployeeId) {
                    const employeeExists = await tx.employee.findUnique({ where: { id: wantedEmployeeId }, select: { id: true } })
                    // O PDV manda um usuário do sistema como colaborador; sem funcionário do RH o vale se perderia.
                    if (!employeeExists) throw new SyncRejection('FUNCIONARIO_NAO_ENCONTRADO', sale.Uuid)
                }
                paymentLinks.push({ clientId: clientExists ? wantedClientId : null, employeeId: wantedEmployeeId })
            }

            // 3. Venda: o caixa de uma venda que já existe nunca muda.
            await tx.sale.upsert({
                where: { id: sale.Uuid },
                update: {
                    total_amount: sale.TotalAmount,
                    discount: sale.Discount,
                    status: sale.Status,
                    cashier_session_id: targetSessionId,
                },
                create: {
                    id: sale.Uuid,
                    total_amount: sale.TotalAmount,
                    discount: sale.Discount,
                    status: sale.Status,
                    cashier_session_id: targetSessionId,
                    created_at: saleCreatedAt,
                }
            })

            // 4. Lançamentos de caixa da venda: só no caixa DELA. Se mudaram (pagamento alterado, cancelamento), troca todos;
            //    antes, trocar a forma com um pagamento não chegava à nuvem e com vários pagamentos duplicava.
            if (entriesChanged) {
                if (storedEntries.length > 0) {
                    await tx.cashierEntry.deleteMany({ where: { id: { in: storedEntries.map(e => e.id) } } })
                }
                for (let i = 0; i < desiredEntries.length; i++) {
                    const entry = desiredEntries[i]
                    await tx.cashierEntry.create({
                        data: {
                            cashier_session_id: targetSessionId!,
                            origin: sale.Origin || 'PDV',
                            payment_method: entry.payment_method,
                            amount: entry.amount,
                            type: 'SALE',
                            identification: entry.identification,
                            source: 'PDV',
                            client_id: paymentLinks[i]?.clientId ?? null,
                            employee_id: paymentLinks[i]?.employeeId ?? null,
                            created_at: saleCreatedAt
                        }
                    })
                }
            }

            // 5. Fiado e consumo de funcionário (cliente e funcionário já conferidos acima; não duplicam no reenvio)
            for (let i = 0; i < positivePayments.length; i++) {
                const pay = positivePayments[i]
                const targetClientId = paymentLinks[i].clientId
                const targetEmployeeId = paymentLinks[i].employeeId

                // Venda a Prazo: cria conta a receber (ClientTab)
                if (isTermPayment(pay.Method) && targetClientId) {
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
                                cashier_session_id: targetSessionId,
                                amount: pay.Amount,
                                description: `Venda a Prazo - Pedido #${sale.Uuid.slice(0, 8)} (${pay.NomeTitular || 'Cliente'})`,
                                is_paid: false,
                                created_at: saleCreatedAt
                            }
                        })
                    }
                }

                // Venda para Funcionário: cria lançamento em folha / vale (PayrollEntry)
                if (targetEmployeeId) {
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

            // 6. Processar Itens da Venda e Motor de Baixa de Insumos da Ficha Técnica
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
                    // Custo congelado do item: usa o que o PDV congelou na venda e completa o que faltar pelo cadastro
                    const cost = await buildItemCost(tx, item)

                    await tx.saleItem.create({
                        data: {
                            id: item.Uuid,
                            sale_id: sale.Uuid,
                            product_id: validProductId,
                            quantity: item.Quantity,
                            unit_price: item.UnitPrice,
                            discount: item.Discount,
                            unit_cost: cost.unit_cost,
                            complements_cost: cost.complements_cost,
                            cost_source: cost.source,
                            cost_snapshot: cost.snapshot as unknown as Prisma.InputJsonValue,
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
                                } else if (fracProd) {
                                    // Sabor que é produto simples (sem ficha técnica): baixa a fração do próprio produto
                                    const deduction = frac.Fraction * item.Quantity

                                    await tx.stock.create({
                                        data: {
                                            product_id: fracProd.id,
                                            quantity: deduction,
                                            unit_cost: fracProd.cost ?? null,
                                            operation: 'OUT',
                                            description: 'VENDA',
                                            created_at: saleCreatedAt
                                        }
                                    })

                                    await tx.product.update({
                                        where: { id: fracProd.id },
                                        data: { stock: { decrement: deduction } }
                                    })
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
                                        // Quantidade escolhida da opção (ex.: 2x bacon) multiplica o consumo do insumo
                                        const deduction = targetQuantity * (compOpt.Quantity ?? 1) * item.Quantity

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
        }, { timeout: 30000, maxWait: 10000 })
    } catch (err) {
        // Recusa com motivo (409): o PDV isola a venda, tenta de novo com espera e mostra o motivo em "Estado da sincronia".
        if (err instanceof SyncRejection) return reply.status(409).send(err.toResponse())
        throw err
    }

    return reply.status(201).send({ message: 'Vendas e baixas de CMV sincronizadas com sucesso' })
}
