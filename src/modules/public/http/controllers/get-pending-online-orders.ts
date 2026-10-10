import { FastifyReply, FastifyRequest } from 'fastify'
import { requestContext } from '@fastify/request-context'
import { diaOperacional, inicioDoDiaOperacional } from '@/lib/dia-operacional'
import { montarPedidosOnline } from './pedido-online-dto'

export async function getPendingOnlineOrders(request: FastifyRequest, reply: FastifyReply) {
    const prisma = requestContext.get('prisma')
    if (!prisma) {
        return reply.status(500).send({ message: 'Internal server error: Prisma context missing.' })
    }

    try {
        // 1. HorÃ¡rio de corte oficial: fuso horÃ¡rio de BrasÃ­lia (UTC-3)
        // Dia operacional (vira às 05:00 de Brasília): um caixa que passa da meia-noite continua vendo os
        // pedidos da madrugada. Antes a janela era o dia do calendário (00:00 às 23:59) e eles sumiam da barra.
        const spDateStr = diaOperacional(new Date()); // 'YYYY-MM-DD'

                const { date, includeCancelled } = (request.query as { date?: string; includeCancelled?: string }) || {};
        // O PDV pede os cancelados (includeCancelled=1) para descobrir pedidos que o iFood cancelou sozinho; o web não.
        const withCancelled = includeCancelled === '1' || includeCancelled === 'true';
        const requestedDate = /^\d{4}-\d{2}-\d{2}$/.test(date || '') ? date! : spDateStr;
        const requestedDayStart = inicioDoDiaOperacional(requestedDate);
        const requestedDayEnd = new Date(requestedDayStart.getTime() + 24 * 60 * 60 * 1000 - 1);

        const allowedOrigins = ['Delivery', 'Balcão', 'Balcao', 'BalcÃ£o', 'Retirada', 'Takeout', 'iFood', '99Food', 'PDV'];

                // A gestão de pedidos é compartilhada entre todos os caixas.
        // O caixa só é definido na baixa; a visualização é exclusivamente por data.
        const whereClause: any = {
            data_abertura: { gte: requestedDayStart, lte: requestedDayEnd },
            status: withCancelled ? undefined : { notIn: ['Cancelado'] },
            OR: [
                { origem: { in: allowedOrigins } },
                { sincronizado_web: true },
                { observacao: { contains: 'Retirada', mode: 'insensitive' } }
            ]
        };

        const pedidos = await prisma.pedido.findMany({
            where: whereClause,
            include: {
                itens: true
            },
            orderBy: {
                data_abertura: 'desc'
            }
        });

        // Mesmo formato do aviso ao vivo do canal (orders-stream.ts): os dois montam o pedido no mesmo lugar
        const orders = await montarPedidosOnline(prisma, pedidos);

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
            orders
        });
    } catch (error: any) {
        console.error('Erro ao buscar pedidos online pendentes:', error);
        return reply.status(500).send({
            message: 'Erro ao buscar pedidos online.',
            error: error.message
        });
    }
}
