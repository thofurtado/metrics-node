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

        const addressIds = pedidos.map(p => p.endereco_entrega_id).filter(Boolean) as string[];
        const addresses = await prisma.address.findMany({
            where: { id: { in: addressIds } }
        });
        const addressMap = new Map(addresses.map(a => [a.id, a]));

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

        const restaurantAddress = profile?.street
            ? `${profile.street}, ${profile.number || 'S/N'} - ${profile.neighborhood || ''}, ${profile.city || ''}`
            : (profile?.tradeName || 'Restaurante');

        return reply.status(200).send({
            profile: {
                trade_name: profile?.tradeName || 'Restaurante',
                street: profile?.street || '',
                number: profile?.number || '',
                neighborhood: profile?.neighborhood || '',
                city: profile?.city || '',
                state: profile?.state || '',
                zipcode: profile?.zipcode || '',
                restaurant_address: restaurantAddress,
                delivery_time_min: profile?.deliveryTimeMin || 30,
                delivery_time_max: profile?.deliveryTimeMax || 60,
                delivery_sectors: profile?.deliverySectors ? (typeof profile.deliverySectors === 'string' ? JSON.parse(profile.deliverySectors) : profile.deliverySectors) : []
            },
            orders: pedidos.map(p => {
                const client = p.cliente_id ? clientMap.get(p.cliente_id) : null;
                
                // Prioriza o endereço histórico salvo no pedido em endereco_entrega_id
                const orderAddr = p.endereco_entrega_id 
                    ? addressMap.get(p.endereco_entrega_id) 
                    : (client?.addresses?.[0] || null);

                const cityStr = orderAddr?.city ? `, ${orderAddr.city}` : '';
                const address = orderAddr
                    ? `${orderAddr.street}, ${orderAddr.number} - ${orderAddr.neighborhood}${cityStr}`
                    : '';
                const neighborhood = orderAddr?.neighborhood || '';
                const city = orderAddr?.city || '';
                const zipcode = orderAddr?.zipcode || '';

                return {
                    id: p.uuid,
                    display_id: p.display_id,
                    status: mappedStatus(p.status_delivery, p.status),
                    client_name: client?.name || 'Cliente',
                    client_phone: client?.phone || '',
                    address: address,
                    neighborhood: neighborhood,
                    city: city,
                    zipcode: zipcode,
                    total_amount: p.valor_final,
                    delivery_fee: p.valor_frete || 0,
                    delivery_man: p.entregador || null,
                    departed_at: p.hora_saida_rota || null,
                    observations: p.observacao || '',
                    change_for: p.valor_troco ? Number(p.valor_troco) : undefined,
                    created_at: p.data_abertura,
                    items: p.itens.map(i => {
                        let complements: any[] = [];
                        try {
                            complements = i.complementos_json ? JSON.parse(i.complementos_json) : [];
                        } catch (e) {}

                        return {
                            id: i.uuid || String(i.id),
                            name: productMap.get(i.produto_id || '') || 'Item',
                            quantity: i.quantidade,
                            price: i.valor_unitario,
                            observation: i.observacao,
                            complements: complements
                        };
                    })
                };
            })
        });
    } catch (error: any) {
        console.error('Erro ao buscar pedidos online pendentes:', error);
        return reply.status(500).send({
            message: 'Erro ao buscar pedidos online.',
            error: error.message
        });
    }
}
