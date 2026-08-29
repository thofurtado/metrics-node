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
        id: z.string().uuid()
    });

    const bodySchema = z.object({
        status: z.enum(['pending', 'in_preparation', 'dispatched', 'delivered', 'cancelled']),
        cashier_session_id: z.string().uuid().optional(),
        payment_method: z.string().optional()
    });

    const { id } = paramsSchema.parse(request.params);
    const { status, cashier_session_id, payment_method } = bodySchema.parse(request.body);

    try {
        const existingTreatment = await prisma.treatment.findUnique({
            where: { id },
            include: {
                client: true,
                items: {
                    include: { product: true }
                }
            }
        });

        if (!existingTreatment) {
            return reply.status(404).send({ message: 'Pedido não encontrado.' });
        }

        const updated = await prisma.treatment.update({
            where: { id },
            data: {
                status: status,
                ending_date: status === 'delivered' ? new Date() : undefined
            }
        });

        // Se o status for 'delivered' e tiver cashier_session_id, lança automaticamente na sessão de caixa
        if (status === 'delivered' && cashier_session_id) {
            // Extrai forma de pagamento das observações ou do body
            let formaPgto = payment_method || 'PIX';
            if (!payment_method && existingTreatment.observations) {
                if (existingTreatment.observations.includes('Dinheiro')) formaPgto = 'Dinheiro';
                else if (existingTreatment.observations.includes('Débito')) formaPgto = 'Cartão de Débito';
                else if (existingTreatment.observations.includes('Crédito')) formaPgto = 'Cartão de Crédito';
                else formaPgto = 'PIX';
            }

            const clientName = existingTreatment.client?.name || 'Cliente Online';
            const displayId = (existingTreatment as any).display_id || '';

            await prisma.cashierEntry.create({
                data: {
                    cashier_session_id,
                    amount: existingTreatment.amount || 0,
                    payment_method: formaPgto,
                    origin: 'Delivery',
                    identification: `Delivery #${displayId} - ${clientName}`,
                    type: 'SALE',
                    client_id: existingTreatment.client_id
                }
            });
            console.log(`[Cashier] Pedido Delivery #${displayId} lançado com sucesso no caixa (${cashier_session_id})`);
        }

        // Dispara notificação SSE para todos os ouvintes do tenant
        const rawDomain = (request.headers['x-tenant-domain'] as string) || request.hostname;
        sseManager.notifyTenant(rawDomain, 'order_status_updated', {
            id: updated.id,
            display_id: (updated as any).display_id,
            status: updated.status,
            client_name: existingTreatment.client?.name || 'Cliente',
            client_phone: existingTreatment.client?.phone || '',
            amount: updated.amount,
            updated_at: new Date()
        });

        return reply.status(200).send({
            message: 'Status atualizado para ' + status,
            treatment: updated
        });
    } catch (error) {
        console.error('Erro ao atualizar status do pedido online:', error);
        return reply.status(500).send({ message: 'Erro ao atualizar status do pedido.' });
    }
}
