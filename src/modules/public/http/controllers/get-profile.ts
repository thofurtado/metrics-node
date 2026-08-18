import { FastifyReply, FastifyRequest } from 'fastify'
import { requestContext } from '@fastify/request-context'

export async function getProfile(request: FastifyRequest, reply: FastifyReply) {
  const prisma = requestContext.get('prisma')

  if (!prisma) {
    return reply.status(500).send({ message: 'Internal server error: Prisma client not found in context.' })
  }

  try {
    const profile = await prisma.companyProfile.findFirst({
      include: {
        businessHours: {
          orderBy: { dayOfWeek: 'asc' },
        },
      },
    })

    if (!profile) {
      return reply.status(200).send(null)
    }

    return reply.status(200).send({
      ...profile,
      availableNeighborhoods: profile.availableNeighborhoods || [],
      deliverySectors: profile.deliverySectors || [],
    })
  } catch (error) {
    console.error('Error fetching public profile:', error)
    return reply.status(500).send({ message: 'Internal server error.' })
  }
}
