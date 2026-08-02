import { FastifyReply, FastifyRequest } from 'fastify'
import { z } from 'zod'
import { requestContext } from '@fastify/request-context'

export async function updateCompanyProfile(request: FastifyRequest, reply: FastifyReply) {
  const prisma = requestContext.get('prisma')

  if (!prisma) {
    return reply.status(500).send({ message: 'Internal server error: Prisma client not found in context.' })
  }

  const updateProfileBodySchema = z.object({
    tradeName: z.string().optional(),
    primaryColor: z.string().optional(),
    secondaryColor: z.string().optional(),
    backgroundColor: z.string().optional(),
    logo_url: z.string().nullable().optional(),
    banner_url: z.string().nullable().optional(),
    isOpenManual: z.boolean().optional(),
    whatsappNumber: z.string().optional(),
  })

  try {
    const data = updateProfileBodySchema.parse(request.body)

    let profile = await prisma.companyProfile.findFirst()

    if (profile) {
      profile = await prisma.companyProfile.update({
        where: { id: profile.id },
        data,
      })
    } else {
      profile = await prisma.companyProfile.create({
        data: {
          tradeName: data.tradeName ?? 'Restaurante',
          primaryColor: data.primaryColor ?? '#475569',
          secondaryColor: data.secondaryColor ?? '#ffffff',
          backgroundColor: data.backgroundColor ?? '#f8fafc',
          logo_url: data.logo_url ?? null,
          banner_url: data.banner_url ?? null,
          isOpenManual: data.isOpenManual ?? true,
          whatsappNumber: data.whatsappNumber ?? '',
        },
      })
    }

    return reply.status(200).send(profile)
  } catch (error) {
    if (error instanceof z.ZodError) {
      return reply.status(400).send({ message: 'Validation error', issues: error.format() })
    }
    console.error('Error updating company profile:', error)
    return reply.status(500).send({ message: 'Internal server error.' })
  }
}
