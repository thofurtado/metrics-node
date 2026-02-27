import { FastifyReply, FastifyRequest } from 'fastify'
import { z } from 'zod'
import { prisma } from '../../../../lib/prisma'

export async function getClientByPhone(request: FastifyRequest, reply: FastifyReply) {
    const getClientParamsSchema = z.object({
        phone: z.string()
    })

    const { phone } = getClientParamsSchema.parse(request.params)

    const client = await prisma.client.findFirst({
        where: {
            phone
        },
        include: {
            addresses: {
                orderBy: [
                    { is_main: 'desc' },
                    { created_at: 'desc' }
                ],
                take: 1
            }
        }
    })

    if (!client) {
        return reply.status(404).send({ message: 'Client not found.' })
    }

    return reply.status(200).send({ client })
}
