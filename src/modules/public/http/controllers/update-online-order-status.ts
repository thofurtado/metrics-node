import { webPushManager } from '@/lib/web-push-manager'
import { FastifyReply, FastifyRequest } from 'fastify'
import { z } from 'zod'
import { requestContext } from '@fastify/request-context'
import { sseManager } from '@/lib/sse-manager'

export async function updateOnlineOrderStatus(request: FastifyRequest, reply: FastifyReply) {
    const prisma = requestContext.get('prisma')
    if (!prisma) {
        return reply.status(500).send({ message: 'Internal server error: Prisma context missing.' })
    }

    const paramsSchema = z.object({
        id: z.string()
    });

    const bodySchema = z.object({
        status: z.enum(['pending', 'in_preparation', 'dispatched', 'delivered', 'cancelled']),
        cashier_session_id: z.string().uuid().optional(),
        payment_method: z.string().optional(),
        delivery_man: z.string().optional()
    });

    const { id } = paramsSchema.parse(request.params);
    const { status, cashier_session_id, payment_method, delivery_man } = bodySchema.parse(request.body);

    try {
        const existingPedido = await prisma.pedido.findFirst({
            where: {
                OR: [
                    { uuid: id },
                    { id: !isNaN(Number(id)) ? Number(id) : undefined }
                ]
            }
        });

        if (!existingPedido) {
            return reply.status(404).send({ message: 'Pedido não encontrado.' });
        }

        const deliveryStatusMap: Record<string, string> = {
            pending: 'Pendente',
            in_preparation: 'EmPreparo',
            dispatched: 'SaiuEntrega',
            delivered: 'Entregue',
            cancelled: 'Cancelado'
        };

        const mainStatus = status === 'delivered' ? 'Fechado' : (status === 'cancelled' ? 'Cancelado' : 'Aberto');

        const updated = await prisma.pedido.update({
            where: { id: existingPedido.id },
            data: {
                status_delivery: deliveryStatusMap[status] || 'Pendente',
                status: mainStatus,
                data_fechamento: status === 'delivered' ? new Date() : undefined,
                hora_saida_rota: status === 'dispatched' ? new Date() : existingPedido.hora_saida_rota,
                entregador: delivery_man !== undefined ? delivery_man : existingPedido.entregador,
                caixa_id: cashier_session_id || existingPedido.caixa_id
            }
        });

        // Se o status for 'delivered' e tiver cashier_session_id, lança automaticamente na sessão de caixa
        if (status === 'delivered' && cashier_session_id) {
            let formaPgto = payment_method || 'PIX';
            if (!payment_method && existingPedido.observacao) {
                if (existingPedido.observacao.includes('Dinheiro')) formaPgto = 'Dinheiro';
                else if (existingPedido.observacao.includes('Débito')) formaPgto = 'Cartão de Débito';
                else if (existingPedido.observacao.includes('Crédito')) formaPgto = 'Cartão de Crédito';
                else formaPgto = 'PIX';
            }

            let clientName = 'Cliente Online';
            if (existingPedido.cliente_id) {
                const client = await prisma.client.findUnique({ where: { id: existingPedido.cliente_id } });
                if (client?.name) clientName = client.name;
            }

            await prisma.cashierEntry.create({
                data: {
                    cashier_session_id,
                    amount: existingPedido.valor_final || 0,
                    payment_method: formaPgto,
                    bank: card_machine || null,
                    origin: 'Delivery',
                    identification: `Delivery #${existingPedido.display_id} - ${clientName}${card_machine ? ` (${card_machine})` : ''}`,
                    type: 'SALE',
                    client_id: existingPedido.cliente_id
                }
            });
            console.log(`[Cashier] Pedido Delivery #${existingPedido.display_id} lançado com sucesso no caixa (${cashier_session_id})`);
        }

        // Dispara notificação SSE para todos os ouvintes do tenant
        const rawDomain = (request.headers['x-tenant-domain'] as string) || request.hostname;
        // Dispara Web Push Nativo no celular (Google FCM)
        webPushManager.notifyOrderStatus(existingPedido.uuid, existingPedido.display_id, status)

        sseManager.notifyTenant(rawDomain, 'order_status_updated', {
            id: updated.uuid,
            display_id: updated.display_id,
            status: status,
            amount: updated.valor_final,
            updated_at: new Date()
        });

        return reply.status(200).send({
            message: 'Status atualizado para ' + status,
            pedido: updated
        });
    } catch (error) {
        console.error('Erro ao atualizar status do pedido em pedidos:', error);
        return reply.status(500).send({ message: 'Erro ao atualizar status do pedido.' });
    }
}
