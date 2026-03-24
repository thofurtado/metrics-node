import { FastifyRequest, FastifyReply } from 'fastify'
import { prisma } from '@/lib/prisma'

export async function getPublicUsers(request: FastifyRequest, reply: FastifyReply) {
    const users = await prisma.user.findMany({
        select: {
            id: true,
            name: true,
        },
        orderBy: {
            name: 'asc'
        }
    })

    return reply.status(200).send({ users })
}
