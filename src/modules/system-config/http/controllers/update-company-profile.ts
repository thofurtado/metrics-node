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
  googleReviewUrl: z.string().nullable().optional(),
  businessHours: z.array(businessHourSchema).optional(),
})

export async function updateCompanyProfile(request: FastifyRequest, reply: FastifyReply) {
  const prisma = requestContext.get('prisma')

  if (!prisma) {
    return reply.status(500).send({ message: 'Internal server error: Prisma client not found in context.' })
  }

  try {
    const { businessHours, ...rawDbData } = updateProfileBodySchema.parse(request.body)

    let profile = await prisma.companyProfile.findFirst()

    // Processa deliverySectors e anexa googleReviewUrl de forma segura em JSON sem precisar de migration
    let finalSectors: any[] = Array.isArray(rawDbData.deliverySectors) 
      ? rawDbData.deliverySectors.filter((s: any) => s?._type !== 'google_review_config') 
      : [];
    if (rawDbData.googleReviewUrl !== undefined) {
      finalSectors.push({
        _type: 'google_review_config',
        url: (rawDbData.googleReviewUrl || '').trim()
      });
    }

    const dataToSave = {
      ...rawDbData,
      availableNeighborhoods: rawDbData.availableNeighborhoods ?? [],
      deliverySectors: finalSectors,
    };
    delete (dataToSave as any).googleReviewUrl;

    if (profile) {
      profile = await prisma.companyProfile.update({
        where: { id: profile.id },
        data: dataToSave,
      })
    } else {
      profile = await prisma.companyProfile.create({
        data: {
          tradeName: rawDbData.tradeName ?? 'Restaurante',
          primaryColor: rawDbData.primaryColor ?? '#FF5722',
          secondaryColor: rawDbData.secondaryColor ?? '#FFFFFF',
          backgroundColor: rawDbData.backgroundColor ?? '#F9F9F9',
          logo_url: rawDbData.logo_url ?? null,
          banner_url: rawDbData.banner_url ?? null,
          isOpenManual: rawDbData.isOpenManual ?? true,
          whatsappNumber: rawDbData.whatsappNumber ?? '',
          ...dataToSave,
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
