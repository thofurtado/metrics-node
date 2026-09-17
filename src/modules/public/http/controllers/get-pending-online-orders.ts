import { FastifyReply, FastifyRequest } from 'fastify'
import { requestContext } from '@fastify/request-context'

export async function getPendingOnlineOrders(request: FastifyRequest, reply: FastifyReply) {
    const prisma = requestContext.get('prisma')
    if (!prisma) {
        return reply.status(500).send({ message: 'Internal server error: Prisma context missing.' })
    }

    try {
        // 1. HorÃ¡rio de corte oficial: fuso horÃ¡rio de BrasÃ­lia (UTC-3)
        const now = new Date();
        const spDateStr = now.toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' }); // 'YYYY-MM-DD'
        const todayStart = new Date(spDateStr + 'T00:00:00.000-03:00');

        const { cashier_session_id } = (request.query as { cashier_session_id?: string }) || {};

        const allowedOrigins = ['Delivery', 'BalcÃ£o', 'Balcao', 'iFood', '99Food'];

        let targetSession = null;
        if (cashier_session_id) {
            targetSession = await prisma.cashierSession.findUnique({
                where: { id: cashier_session_id }
            });
        } else {
            // Se nÃ£o informou id, busca o caixa atualmente ABERTO para sincronizar o turno
            targetSession = await prisma.cashierSession.findFirst({
                where: { status: 'OPEN' },
                orderBy: { opened_at: 'desc' }
            });
        }

        let whereClause: any;

        // Se for um caixa antigo jÃ¡ FECHADO:
        if (targetSession && targetSession.status === 'CLOSED') {
            whereClause = {
                origem: { in: allowedOrigins },
                caixa_id: targetSession.id
            };
        } else {
            // Caixa ATIVO ou monitor de pedidos de hoje:
            // O corte temporal Ã© o momento de abertura do caixa ativo ou 00h de hoje no Brasil
            // Para turnos noturnos da virada (ex: abriu Ã s 22h de ontem), tolera atÃ© 14h atrÃ¡s, nunca dias passados
            const sessionOpenTime = targetSession?.opened_at ? new Date(targetSession.opened_at) : todayStart;
            const maxLookback = new Date(todayStart.getTime() - 14 * 60 * 60 * 1000);
            const cutoffTime = sessionOpenTime < todayStart
                ? (sessionOpenTime > maxLookback ? sessionOpenTime : todayStart)
                : todayStart;

            whereClause = {
                origem: { in: allowedOrigins },
                data_abertura: { gte: cutoffTime },
                OR: [
                    // 1. Pedidos vinculados expressamente a esta sessÃ£o de caixa (se houver)
                    ...(targetSession ? [{ caixa_id: targetSession.id }] : []),
                    // 2. Pedidos sem caixa vinculado criados hoje (Ã³rfÃ£os para o caixa ativo adotar)
                    { caixa_id: null },
                    // 3. Pedidos criados no turno/hoje nÃ£o cancelados
                    {
                        status: { notIn: ['Cancelado'] }
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
