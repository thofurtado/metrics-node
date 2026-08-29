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

        const pedidos = await prisma.pedido.findMany({
            where: {
                origem: 'Delivery',
                data_abertura: {
                    gte: today
                }
            },
            include: {
                itens: true
            },
            orderBy: {
                data_abertura: 'desc'
            }
        });

        const clientIds = pedidos.map(p => p.cliente_id).filter(Boolean) as string[];
        const clients = await prisma.client.findMany({
            where: { id: { in: clientIds } },
            include: { addresses: true }
        });
        const clientMap = new Map(clients.map(c => [c.id, c]));

        const mappedStatus = (statusDelivery: string | null, status: string) => {
            if (status === 'Fechado' || statusDelivery === 'Entregue') return 'delivered';
            if (statusDelivery === 'SaiuEntrega') return 'dispatched';
            if (statusDelivery === 'EmPreparo') return 'in_preparation';
            if (status === 'Cancelado') return 'cancelled';
            return 'pending';
        };

        return reply.status(200).send({
            orders: pedidos.map(p => {
                const client = p.cliente_id ? clientMap.get(p.cliente_id) : null;
                const address = client?.addresses?.[0]
                    ? `${client.addresses[0].street}, ${client.addresses[0].number} - ${client.addresses[0].neighborhood}`
                    : '';

                return {
                    id: p.uuid,
                    display_id: p.display_id,
                    status: mappedStatus(p.status_delivery, p.status),
                    client_name: client?.name || 'Cliente',
                    client_phone: client?.phone || '',
                    address: address,
                    total_amount: p.valor_final,
                    observations: p.observacao || '',
                    created_at: p.data_abertura,
                    items: p.itens.map(i => ({
                        id: i.uuid,
                        product_id: i.produto_id,
                        name: i.observacao || 'Item',
                        quantity: i.quantidade,
                        price: i.valor_unitario,
                        observation: i.observacao
                    }))
                };
            })
        });
    } catch (error) {
        console.error('Erro ao buscar pedidos em pedidos:', error);
        return reply.status(500).send({ message: 'Erro interno ao buscar pedidos.' });
    }
}
