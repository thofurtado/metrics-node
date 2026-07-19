import { FastifyRequest, FastifyReply } from 'fastify'
import { requestContext } from '@fastify/request-context'
import { PrismaClient } from '@prisma/client'

export async function getPublicUsers(request: FastifyRequest, reply: FastifyReply) {
    const prisma = requestContext.get('prisma') as PrismaClient
    if (!prisma) {
        return reply.status(500).send({ message: 'Prisma Client not found in context' })
    }

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
