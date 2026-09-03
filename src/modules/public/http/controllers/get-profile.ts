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

    let deliverySectors = profile.deliverySectors || [];
    if (typeof deliverySectors === 'string') {
      try {
        deliverySectors = JSON.parse(deliverySectors);
      } catch {
        deliverySectors = [];
      }
    }
    if (!Array.isArray(deliverySectors)) deliverySectors = [];

    const googleReviewConfig = deliverySectors.find((s: any) => s?._type === 'google_review_config');
    const googleReviewUrl = googleReviewConfig?.url || '';
    deliverySectors = deliverySectors.filter((s: any) => s?._type !== 'google_review_config');

    let availableNeighborhoods = profile.availableNeighborhoods || [];
    if (typeof availableNeighborhoods === 'string') {
      try {
        availableNeighborhoods = JSON.parse(availableNeighborhoods);
      } catch {
        availableNeighborhoods = [];
      }
    }
    if (!Array.isArray(availableNeighborhoods)) availableNeighborhoods = [];

    return reply.status(200).send({
      ...profile,
      availableNeighborhoods,
      deliverySectors,
      googleReviewUrl,
      paymentMethods: publicPayments,
    })
  } catch (error) {
    console.error('Error fetching public profile:', error)
    return reply.status(500).send({ message: 'Internal server error.' })
  }
}
