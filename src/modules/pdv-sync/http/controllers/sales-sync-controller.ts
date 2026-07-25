import { FastifyRequest, FastifyReply } from 'fastify'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'

export async function postSalesSync(request: FastifyRequest, reply: FastifyReply) {
    const saleSchema = z.array(z.object({
        Uuid: z.string().uuid(),
        CashierSessionId: z.string().uuid().optional().nullable(),
        TotalAmount: z.number(),
        Discount: z.number().optional().default(0),
        Status: z.string().default('COMPLETED'),
        CreatedAt: z.string().datetime().optional(),
        Items: z.array(z.object({
            Uuid: z.string().uuid(),
            ProductId: z.string().uuid().optional().nullable(),
            Quantity: z.number(),
            UnitPrice: z.number(),
            Discount: z.number().optional().default(0),
        })),
    }))

    const sales = saleSchema.parse(request.body)

    for (const sale of sales) {
        // Upsert sale
        await prisma.sale.upsert({
            where: { id: sale.Uuid },
            update: {
                total_amount: sale.TotalAmount,
                discount: sale.Discount,
                status: sale.Status,
                cashier_session_id: sale.CashierSessionId || null,
            },
            create: {
                id: sale.Uuid,
                total_amount: sale.TotalAmount,
                discount: sale.Discount,
                status: sale.Status,
                cashier_session_id: sale.CashierSessionId || null,
                created_at: sale.CreatedAt ? new Date(sale.CreatedAt) : new Date(),
            }
        })

        // Upsert sale items and deduct stock
        for (const item of sale.Items) {
            const existingItem = await prisma.saleItem.findUnique({
                where: { id: item.Uuid }
            })

            if (!existingItem) {
                await prisma.saleItem.create({
                    data: {
                        id: item.Uuid,
                        sale_id: sale.Uuid,
                        product_id: item.ProductId || null,
                        quantity: item.Quantity,
                        unit_price: item.UnitPrice,
                        discount: item.Discount,
                    }
                })

                // Deduct stock Se houver produto
                if (item.ProductId && sale.Status === 'COMPLETED') {
                    await prisma.stock.create({
                        data: {
                            product_id: item.ProductId,
                            quantity: item.Quantity,
                            operation: 'OUT',
                            description: 'VENDA',
                        }
                    })

                    await prisma.product.update({
                        where: { id: item.ProductId },
                        data: {
                            stock: { decrement: item.Quantity }
                        }
                    })
                }
            }
        }
    }

    return reply.status(201).send({ message: 'Vendas sincronizadas com sucesso' })
}
