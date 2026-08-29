import { FastifyReply, FastifyRequest } from 'fastify'
import { z } from 'zod'
import { requestContext } from '@fastify/request-context'

export async function getOnlineOrderStatus(request: FastifyRequest, reply: FastifyReply) {
    const prisma = requestContext.get('prisma')
    if (!prisma) {
        return reply.status(500).send({ message: 'Internal server error: Prisma context missing.' })
    }

    const paramsSchema = z.object({
        id: z.string()
    });

    const { id } = paramsSchema.parse(request.params);

    try {
        const pedido = await prisma.pedido.findFirst({
            where: {
                OR: [
                    { uuid: id },
                    { id: !isNaN(Number(id)) ? Number(id) : undefined }
                ]
            }
        });

        if (!pedido) {
            return reply.status(404).send({ message: 'Pedido não encontrado.' });
        }

        const mappedStatus = (statusDelivery: string | null, status: string) => {
            if (status === 'Fechado' || statusDelivery === 'Entregue') return 'delivered';
            if (statusDelivery === 'SaiuEntrega') return 'dispatched';
            if (statusDelivery === 'EmPreparo') return 'in_preparation';
            if (status === 'Cancelado') return 'cancelled';
            return 'pending';
        };

        return reply.status(200).send({
            id: pedido.uuid,
            display_id: pedido.display_id,
            status: mappedStatus(pedido.status_delivery, pedido.status),
            created_at: pedido.data_abertura
        });
    } catch (error) {
        console.error('Erro ao buscar status do pedido:', error);
        return reply.status(500).send({ message: 'Erro ao buscar status do pedido.' });
    }
}
