import { FastifyReply, FastifyRequest } from 'fastify'
import { z } from 'zod'
import { requestContext } from '@fastify/request-context'

function extractDisplayId(requestStr: string | null | undefined): number {
    const match = (requestStr || '').match(/#(\d+)/);
    return match ? parseInt(match[1], 10) : 1;
}

export async function getOnlineOrderStatus(request: FastifyRequest, reply: FastifyReply) {
    const prisma = requestContext.get('prisma')
    if (!prisma) {
        return reply.status(500).send({ message: 'Internal server error: Prisma context missing.' })
    }

    const paramsSchema = z.object({
        id: z.string().uuid()
    });

    const { id } = paramsSchema.parse(request.params);

    try {
        const treatment = await prisma.treatment.findUnique({
            where: { id },
            select: {
                id: true,
                request: true,
                status: true,
                created_at: true,
                ending_date: true
            }
        });

        if (!treatment) {
            return reply.status(404).send({ message: 'Pedido não encontrado.' });
        }

        return reply.status(200).send({
            id: treatment.id,
            display_id: extractDisplayId(treatment.request),
            status: treatment.status,
            created_at: treatment.created_at
        });
    } catch (error) {
        console.error('Erro ao buscar status do pedido:', error);
        return reply.status(500).send({ message: 'Erro ao buscar status do pedido.' });
    }
}
