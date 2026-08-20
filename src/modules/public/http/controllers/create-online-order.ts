import { FastifyReply, FastifyRequest } from 'fastify'
import { z } from 'zod'
import { requestContext } from '@fastify/request-context'

export async function createOnlineOrder(request: FastifyRequest, reply: FastifyReply) {
    const prisma = requestContext.get('prisma')
    if (!prisma) {
        return reply.status(500).send({ message: 'Internal server error: Prisma context missing.' })
    }

    const createOnlineOrderSchema = z.object({
        client_name: z.string(),
        client_phone: z.string(),
        street: z.string(),
        number: z.union([z.string(), z.number()]).transform(v => String(v)),
        neighborhood: z.string(),
        city: z.string().optional().default(''),
        state: z.string().optional().default(''),
        zipcode: z.string().optional(),
        complement: z.string().optional(),
        reference: z.string().optional(),
        payment_method_id: z.string().optional(),
        payment_method_name: z.string().default('Dinheiro'),
        change_for: z.number().optional(),
        delivery_fee: z.number().default(0),
        total_amount: z.number(),
        notes: z.string().optional(),
        items: z.array(z.object({
            product_id: z.string(),
            name: z.string(),
            quantity: z.number(),
            unit_price: z.number(),
            unit_cost: z.number().optional().default(0),
            notes: z.string().optional(),
            complements: z.array(z.object({
                name: z.string(),
                price: z.number().default(0),
                quantity: z.number().default(1)
            })).optional(),
            fractions: z.array(z.object({
                product_id: z.string(),
                name: z.string(),
                fraction: z.number().default(0.5)
            })).optional()
        }))
    })

    const body = createOnlineOrderSchema.parse(request.body)

    try {
        let client = await prisma.client.findFirst({
            where: { phone: body.client_phone }
        })

        if (!client) {
            client = await prisma.client.create({
                data: {
                    name: body.client_name,
                    phone: body.client_phone,
                    addresses: {
                        create: {
                            street: body.street,
                            number: parseInt(body.number.replace(/D/g, ''), 10) || 0,
                            neighborhood: body.neighborhood,
                            city: body.city || 'Cidade',
                            state: body.state || 'UF',
                            zipcode: body.zipcode ? parseInt(body.zipcode.replace(/D/g, ''), 10) : null,
                            is_main: true
                        }
                    }
                }
            })
        }

        const lastTreatment = await prisma.treatment.findFirst({
            orderBy: { created_at: 'desc' },
            select: { display_id: true }
        })
        const nextDisplayId = (lastTreatment?.display_id || 0) + 1

        const enderecoFormatado = body.street + ', ' + body.number + ' - ' + body.neighborhood + (body.complement ? ' (' + body.complement + ')' : '');
        const infoPagamento = body.change_for ? body.payment_method_name + ' (Troco para R$ ' + body.change_for.toFixed(2) + ')' : body.payment_method_name;
        
        const fullObservations = [
            '[PEDIDO CARDÁPIO ONLINE]',
            'Entrega: ' + enderecoFormatado,
            'Referência: ' + (body.reference || 'N/A'),
            'Pagamento: ' + infoPagamento,
            'Taxa de Entrega: R$ ' + body.delivery_fee.toFixed(2),
            body.notes ? 'Obs: ' + body.notes : null
        ].filter(Boolean).join('
');

        const treatment = await prisma.treatment.create({
            data: {
                display_id: nextDisplayId,
                client_id: client.id,
                request: 'DELIVERY ONLINE #' + nextDisplayId + ' - ' + body.client_name,
                observations: fullObservations,
                amount: body.total_amount,
                status: 'pending',
                payment_status: 'pending',
                opening_date: new Date(),
                items: {
                    create: body.items.map(item => {
                        const complementStr = item.complements && item.complements.length > 0
                            ? ' + [' + item.complements.map(c => c.quantity + 'x ' + c.name + ' (R$ ' + c.price.toFixed(2) + ')').join(', ') + ']'
                            : '';
                        
                        const itemDescription = item.name + complementStr + (item.notes ? ' (Obs: ' + item.notes + ')' : '');

                        return {
                            product_id: item.product_id,
                            quantity: item.quantity,
                            price: item.unit_price,
                            observation: itemDescription
                        };
                    })
                }
            },
            include: {
                items: {
                    include: {
                        product: true
                    }
                },
                client: {
                    include: {
                        addresses: true
                    }
                }
            }
        });

        return reply.status(201).send({
            message: 'Pedido realizado com sucesso!',
            order_id: treatment.id,
            display_id: treatment.display_id,
            status: 'PENDING_ACCEPT',
            total_amount: treatment.amount,
            estimated_time_minutes: 40
        });
    } catch (error) {
        console.error('Erro ao criar pedido online:', error);
        return reply.status(500).send({ message: 'Erro interno ao processar pedido online.' });
    }
}
