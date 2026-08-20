import { FastifyReply, FastifyRequest } from 'fastify'
import { z } from 'zod'
import { requestContext } from '@fastify/request-context'

export async function updateOnlineOrderStatus(request: FastifyRequest, reply: FastifyReply) {
    const prisma = requestContext.get('prisma')
    if (!prisma) {
        return reply.status(500).send({ message: 'Internal server error: Prisma context missing.' })
    }

    const paramsSchema = z.object({
        id: z.string().uuid()
    });

    const bodySchema = z.object({
        status: z.enum(['ACCEPTED', 'IN_PRODUCTION', 'OUT_FOR_DELIVERY', 'DELIVERED', 'CANCELLED'])
    });

    const { id } = paramsSchema.parse(request.params);
    const { status } = bodySchema.parse(request.body);

    try {
        const mappedStatus = (status === 'ACCEPTED' || status === 'IN_PRODUCTION') 
            ? 'in_progress' 
            : (status === 'DELIVERED' ? 'resolved' : (status === 'CANCELLED' ? 'cancelled' : 'in_progress'));

        const updated = await prisma.treatment.update({
            where: { id },
            data: {
                status: mappedStatus as any
            }
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
