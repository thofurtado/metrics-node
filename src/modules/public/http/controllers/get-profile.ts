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

    // Buscar formas de pagamento ativas para o delivery / cardápio
    let publicPayments: any[] = [];
    try {
      publicPayments = await prisma.payment.findMany({
        where: {
          active: true,
          active_for_out: true,
        },
        select: {
          id: true,
          name: true,
          in_sight: true,
          installment_limit: true,
        },
        orderBy: {
          name: 'asc',
        },
      });
    } catch { }

    return reply.status(200).send({
      ...profile,
      availableNeighborhoods: profile.availableNeighborhoods || [],
      deliverySectors: profile.deliverySectors || [],
      paymentMethods: publicPayments,
    })
  } catch (error) {
    console.error('Error fetching public profile:', error)
    return reply.status(500).send({ message: 'Internal server error.' })
  }
}
