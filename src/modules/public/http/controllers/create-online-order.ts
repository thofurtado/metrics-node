import { FastifyReply, FastifyRequest } from 'fastify'
import { z } from 'zod'
import { requestContext } from '@fastify/request-context'
import { sseManager } from '@/lib/sse-manager'

function extractDisplayId(requestStr: string | null | undefined): number {
    const match = (requestStr || '').match(/#(\d+)/);
    return match ? parseInt(match[1], 10) : 1;
}

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
        const cleanPhone = body.client_phone.replace(/\D/g, '');
        let client = await prisma.client.findFirst({
            where: {
                OR: [
                    { phone: cleanPhone },
                    { phone: body.client_phone }
                ]
            }
        });

        if (!client) {
            client = await prisma.client.create({
                data: {
                    name: body.client_name,
                    phone: cleanPhone || body.client_phone,
                    addresses: {
                        create: {
                            street: body.street,
                            number: String(body.number || 'S/N'),
                            neighborhood: body.neighborhood,
                            city: body.city || 'Cidade',
                            state: body.state || 'UF',
                            zipcode: body.zipcode ? String(body.zipcode) : undefined,
                            complement: body.complement || undefined,
                            is_main: true
                        }
                    }
                }
            });
        }

        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const countToday = await prisma.treatment.count({
            where: {
                created_at: { gte: today }
            }
        });
        const displayId = countToday + 1;

        const enderecoFormatado = body.street + ', ' + body.number + ' - ' + body.neighborhood + (body.complement ? ' (' + body.complement + ')' : '');
        const infoPagamento = body.change_for ? body.payment_method_name + ' (Troco para R$ ' + body.change_for.toFixed(2) + ')' : body.payment_method_name;
        
        const fullObservations = [
            '[PEDIDO CARDÁPIO ONLINE]',
            'Entrega: ' + enderecoFormatado,
            'Referência: ' + (body.reference || 'N/A'),
            'Pagamento: ' + infoPagamento,
            'Taxa de Entrega: R$ ' + body.delivery_fee.toFixed(2),
            body.notes ? 'Obs: ' + body.notes : null
        ].filter(Boolean).join('\n');

        const treatment = await prisma.treatment.create({
            data: {
                client_id: client.id,
                request: 'DELIVERY ONLINE #' + displayId + ' - ' + body.client_name,
                observations: fullObservations,
                amount: body.total_amount,
                status: 'pending',
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
                            observations: itemDescription
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

        // Dispara notificação SSE em tempo real para os PDVs do tenant conectado
        const rawDomain = (request.headers['x-tenant-domain'] as string) || request.hostname;
        const orderDto = {
            id: treatment.id,
            display_id: displayId,
            client_name: treatment.client?.name || body.client_name,
            client_phone: treatment.client?.phone || body.client_phone,
            address: enderecoFormatado,
            total_amount: treatment.amount,
            observations: treatment.observations,
            created_at: treatment.created_at,
            items: treatment.items.map(i => ({
                id: i.id,
                product_id: i.product_id,
                name: i.product?.name || i.observations || 'Item',
                quantity: i.quantity,
                price: i.salesValue || 0,
                observation: i.observations
            }))
        };

        sseManager.notifyTenant(rawDomain, 'new_order', orderDto);

        return reply.status(201).send({
            message: 'Pedido realizado com sucesso!',
            order_id: treatment.id,
            display_id: displayId,
            status: 'pending',
            total_amount: treatment.amount,
            estimated_time_minutes: 40
        });
    } catch (error) {
        console.error('Erro ao criar pedido online:', error);
        return reply.status(500).send({ message: 'Erro interno ao processar pedido online.' });
    }
}
