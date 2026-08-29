import { FastifyReply, FastifyRequest } from 'fastify'
import { requestContext } from '@fastify/request-context'

export async function getPendingOnlineOrders(request: FastifyRequest, reply: FastifyReply) {
    const prisma = requestContext.get('prisma')
    if (!prisma) {
        return reply.status(500).send({ message: 'Internal server error: Prisma context missing.' })
    }

    try {
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const orders = await prisma.treatment.findMany({
            where: {
                request: {
                    contains: 'DELIVERY'
                },
                created_at: {
                    gte: today
                }
            },
            include: {
                client: {
                    include: {
                        addresses: {
                            where: { is_main: true }
                        }
                    }
                },
                items: {
                    include: {
                        product: true
                    }
                }
            },
            orderBy: {
                created_at: 'desc'
            }
        });

        return reply.status(200).send({
            orders: orders.map(o => ({
                id: o.id,
                display_id: (o as any).display_id || 0,
                status: o.status,
                client_name: o.client?.name || 'Cliente',
                client_phone: o.client?.phone || '',
                address: o.client?.addresses?.[0] 
                    ? o.client.addresses[0].street + ', ' + o.client.addresses[0].number + ' - ' + o.client.addresses[0].neighborhood 
                    : '',
                total_amount: o.amount || 0,
                observations: o.observations || '',
                created_at: o.created_at,
                items: o.items.map(i => ({
                    id: i.id,
                    product_id: i.product_id,
                    name: i.product?.name || i.observation || 'Item',
                    quantity: i.quantity,
                    price: i.price,
                    observation: i.observation
                }))
            }))
        });
    } catch (error) {
        console.error('Erro ao buscar pedidos online:', error);
        return reply.status(500).send({ message: 'Erro interno ao buscar pedidos.' });
    }
}
