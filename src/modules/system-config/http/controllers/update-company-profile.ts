import { FastifyReply, FastifyRequest } from 'fastify'
import { z } from 'zod'
import { requestContext } from '@fastify/request-context'

const businessHourSchema = z.object({
  dayOfWeek: z.number().min(0).max(6),
  openTime: z.string(),
  closeTime: z.string(),
  isOpen: z.boolean(),
})

const updateProfileBodySchema = z.object({
  tradeName: z.string().optional(),
  companyName: z.string().nullable().optional(),
  document: z.string().nullable().optional(),
  primaryColor: z.string().optional(),
  secondaryColor: z.string().optional(),
  backgroundColor: z.string().optional(),
  logo_url: z.string().nullable().optional(),
  banner_url: z.string().nullable().optional(),
  isOpenManual: z.boolean().optional(),
  whatsappNumber: z.string().optional(),
  street: z.string().nullable().optional(),
  number: z.string().nullable().optional(),
  neighborhood: z.string().nullable().optional(),
  city: z.string().nullable().optional(),
  state: z.string().nullable().optional(),
  zipcode: z.string().nullable().optional(),
  deliveryFee: z.number().optional(),
  minOrderValue: z.number().optional(),
  deliveryTimeMin: z.number().optional(),
  deliveryTimeMax: z.number().optional(),
  availableNeighborhoods: z.array(z.string()).optional(),
  deliverySectors: z.array(z.any()).optional(),
  ifoodMerchantId: z.string().nullable().optional(),
  anotaAiApiKey: z.string().nullable().optional(),
  pixKey: z.string().nullable().optional(),
  businessHours: z.array(businessHourSchema).optional(),
})

export async function updateCompanyProfile(request: FastifyRequest, reply: FastifyReply) {
  const prisma = requestContext.get('prisma')

  if (!prisma) {
    return reply.status(500).send({ message: 'Internal server error: Prisma client not found in context.' })
  }

  try {
    const { businessHours, ...data } = updateProfileBodySchema.parse(request.body)

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
          primaryColor: data.primaryColor ?? '#FF5722',
          secondaryColor: data.secondaryColor ?? '#FFFFFF',
          backgroundColor: data.backgroundColor ?? '#F9F9F9',
          logo_url: data.logo_url ?? null,
          banner_url: data.banner_url ?? null,
          isOpenManual: data.isOpenManual ?? true,
          whatsappNumber: data.whatsappNumber ?? '',
          ...data,
        },
      })
    }

    if (businessHours && profile) {
      // Re-create business hours for this profile
      await prisma.businessHour.deleteMany({
        where: { company_profile_id: profile.id },
      })

      if (businessHours.length > 0) {
        await prisma.businessHour.createMany({
          data: businessHours.map((bh) => ({
            company_profile_id: profile.id,
            dayOfWeek: bh.dayOfWeek,
            openTime: bh.openTime,
            closeTime: bh.closeTime,
            isOpen: bh.isOpen,
          })),
        })
      }
    }

    const updatedProfile = await prisma.companyProfile.findUnique({
      where: { id: profile.id },
      include: { businessHours: true },
    })

    return reply.status(200).send(updatedProfile)
  } catch (error) {
    if (error instanceof z.ZodError) {
      return reply.status(400).send({ message: 'Validation error', issues: error.format() })
    }
    console.error('Error updating company profile:', error)
    return reply.status(500).send({ message: 'Internal server error.' })
  }
}

