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

        const productIds = pedidos.flatMap(p => p.itens.map(i => i.produto_id)).filter(Boolean) as string[];
        const products = await prisma.product.findMany({
            where: { id: { in: productIds } }
        });
        const productMap = new Map(products.map(pr => [pr.id, pr.name]));

        const mappedStatus = (statusDelivery: string | null, status: string) => {
            if (status === 'Fechado' || statusDelivery === 'Entregue') return 'delivered';
            if (statusDelivery === 'SaiuEntrega') return 'dispatched';
            if (statusDelivery === 'EmPreparo') return 'in_preparation';
            if (status === 'Cancelado') return 'cancelled';
            return 'pending';
        };

        const profile = await prisma.companyProfile.findFirst();

        return reply.status(200).send({
            profile: {
                delivery_time_min: profile?.deliveryTimeMin || 30,
                delivery_time_max: profile?.deliveryTimeMax || 60,
                delivery_sectors: profile?.deliverySectors ? (typeof profile.deliverySectors === 'string' ? JSON.parse(profile.deliverySectors) : profile.deliverySectors) : []
            },
            orders: pedidos.map(p => {
                const client = p.cliente_id ? clientMap.get(p.cliente_id) : null;
                const clientAddr = client?.addresses?.[0];
                const address = clientAddr
                    ? `${clientAddr.street}, ${clientAddr.number} - ${clientAddr.neighborhood}`
                    : '';
                const neighborhood = clientAddr?.neighborhood || '';

                return {
                    id: p.uuid,
                    display_id: p.display_id,
                    status: mappedStatus(p.status_delivery, p.status),
                    client_name: client?.name || 'Cliente',
                    client_phone: client?.phone || '',
                    address: address,
                    neighborhood: neighborhood,
                    total_amount: p.valor_final,
                    delivery_fee: p.valor_frete || 0,
                    delivery_man: p.entregador || null,
                    departed_at: p.hora_saida_rota || null,
                    observations: p.observacao || '',
                    created_at: p.data_abertura,
                    items: p.itens.map(i => {
                        let complements: any[] = [];
                        try {
                            complements = i.complementos_json ? JSON.parse(i.complementos_json) : [];
                        } catch (e) {}

                        const prodName = (i.produto_id && productMap.get(i.produto_id))
                            || (i.observacao ? i.observacao.split(' + [')[0]?.split(' (Obs:')[0] : 'Item');

                        // Limpa observação para nunca repetir os adicionais nem o nome do produto
                        let cleanObs = i.observacao || '';
                        if (cleanObs.includes('(Obs: ')) {
                            cleanObs = cleanObs.split('(Obs: ')[1]?.replace(/\)$/, '') || '';
                        } else if (cleanObs.includes('+ [')) {
                            cleanObs = '';
                        }

                        if (cleanObs.trim().toLowerCase() === prodName.trim().toLowerCase()) {
                            cleanObs = '';
                        }

                        return {
                            id: i.uuid,
                            product_id: i.produto_id,
                            name: prodName,
                            quantity: i.quantidade,
                            price: i.valor_unitario,
                            complements: complements,
                            observation: cleanObs
                        };
                    })
                };
            })
        });
    } catch (error) {
        console.error('Erro ao buscar pedidos em pedidos:', error);
        return reply.status(500).send({ message: 'Erro interno ao buscar pedidos.' });
    }
}
