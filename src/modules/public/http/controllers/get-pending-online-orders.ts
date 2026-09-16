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

        const { cashier_session_id } = (request.query as { cashier_session_id?: string }) || {};

        const allowedOrigins = ['Delivery', 'Balcão', 'Balcao', 'iFood', '99Food'];

        let whereClause: any = {
            origem: { in: allowedOrigins }
        };

        if (cashier_session_id) {
            const targetSession = await prisma.cashierSession.findUnique({
                where: { id: cashier_session_id }
            });

            if (targetSession) {
                const sessionOpenTime = targetSession.opened_at ? new Date(targetSession.opened_at) : today;
                whereClause = {
                    origem: { in: allowedOrigins },
                    OR: [
                        // 1. Pedidos expressamente vinculados a esta sessão de caixa
                        { caixa_id: cashier_session_id },
                        // 2. Pedidos em andamento (pendentes, produção, conferencia, rota)
                        {
                            status: { notIn: ['Fechado', 'Cancelado'] },
                            status_delivery: { notIn: ['Entregue', 'Cancelado', 'Finalizado'] }
                        },
                        // 3. Se a sessão for ABERTA, inclui pedidos sem caixa criados a partir do momento em que este caixa abriu
                        ...(targetSession.status === 'OPEN' ? [{
                            caixa_id: null,
                            data_abertura: { gte: sessionOpenTime }
                        }] : [])
                    ]
                };
            } else {
                whereClause = {
                    origem: { in: allowedOrigins },
                    caixa_id: cashier_session_id
                };
            }
        } else {
            whereClause = {
                origem: { in: allowedOrigins },
                OR: [
                    // 1. Pedidos ainda em andamento / pendentes (independente da data de abertura)
                    {
                        status: { notIn: ['Fechado', 'Cancelado'] },
                        status_delivery: { notIn: ['Entregue', 'Cancelado', 'Finalizado'] }
                    },
                    // 2. Pedidos de hoje
                    {
                        data_abertura: { gte: today }
                    }
                ]
            };
        }

        const pedidos = await prisma.pedido.findMany({
            where: whereClause,
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
            if (status === 'Fechado' || statusDelivery === 'Entregue' || statusDelivery === 'Finalizado') return 'delivered';
            if (statusDelivery === 'SaiuEntrega' || statusDelivery === 'EmRota') return 'dispatched';
            if (statusDelivery === 'Conferencia') return 'conferencia';
            if (statusDelivery === 'EmPreparo' || statusDelivery === 'EmProducao') return 'in_preparation';
            if (status === 'Cancelado' || statusDelivery === 'Cancelado') return 'cancelled';
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
                
                const isTakeout = 
                    p.origem === 'Balcão' || 
                    p.origem === 'Balcao' || 
                    (Boolean(p.observacao) && p.observacao!.toLowerCase().includes('retirada')) || 
                    !p.endereco_entrega_id;

                // Prioriza o endereço histórico salvo no pedido em endereco_entrega_id somente se NÃO for retirada
                const orderAddr = (!isTakeout && p.endereco_entrega_id) 
                    ? addressMap.get(p.endereco_entrega_id) 
                    : null;

                const cityStr = orderAddr?.city ? `, ${orderAddr.city}` : '';
                const address = isTakeout 
                    ? 'Retirada no Balcão' 
                    : (orderAddr 
                        ? `${orderAddr.street}, ${orderAddr.number} - ${orderAddr.neighborhood}${cityStr}`
                        : '');
                const neighborhood = isTakeout ? 'Balcão' : (orderAddr?.neighborhood || '');
                const city = isTakeout ? '' : (orderAddr?.city || '');
                const zipcode = isTakeout ? '' : (orderAddr?.zipcode || '');

                return {
                    id: p.uuid,
                    display_id: p.display_id,
                    origem: p.origem,
                    is_takeout: isTakeout,
                    status: mappedStatus(p.status_delivery, p.status),
                    status_delivery: p.status_delivery || 'Pendente',
                    raw_status: p.status || 'Aberto',
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
                    caixa_id: p.caixa_id || null,
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
