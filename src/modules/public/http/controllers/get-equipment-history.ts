import { FastifyReply, FastifyRequest } from 'fastify'
import { z } from 'zod'
import { prisma } from '../../../../lib/prisma'

export async function getEquipmentHistory(request: FastifyRequest, reply: FastifyReply) {
  const paramsSchema = z.object({
    id: z.string(),
  })

  const { id } = paramsSchema.parse(request.params)

  // Buscar por ID ou por identification
  const equipment = await prisma.equipment.findFirst({
    where: {
      OR: [{ id }, { identification: id }],
    },
    include: {
      client: {
        select: {
          id: true,
          name: true,
          phone: true,
          group: {
            select: {
              id: true,
              name: true,
            },
          },
        },
      },
      treatments: {
        include: {
          items: {
            include: {
              product: {
                select: {
                  name: true,
                },
              },
              service: {
                select: {
                  name: true,
                },
              },
            },
          },
          interactions: {
            orderBy: {
              created_at: 'asc',
            },
          },
        },
        orderBy: {
          created_at: 'desc',
        },
      },
    },
  })

  if (!equipment) {
    return reply.status(404).send({ message: 'Equipamento não encontrado no cadastro.' })
  }

  const formattedTreatments = equipment.treatments.map((t) => ({
    id: t.id,
    openingDate: t.opening_date,
    endingDate: t.ending_date,
    request: t.request,
    status: t.status,
    observations: t.observations,
    items: t.items.map((i) => ({
      id: i.id,
      name: i.product?.name || i.service?.name || i.observations || 'Serviço Técnico',
      quantity: i.quantity,
    })),
    interactions: t.interactions.map((inter) => ({
      id: inter.id,
      observations: inter.observations,
      createdAt: inter.created_at,
    })),
  }))

  return reply.status(200).send({
    equipment: {
      id: equipment.id,
      identification: equipment.identification || 'Computador Sem Nome',
      type: equipment.type,
      brand: equipment.brand || 'Personalizado',
      details: equipment.details,
      createdAt: equipment.created_at,
      clientName: equipment.client?.name || 'Cliente Particular',
      groupName: equipment.client?.group?.name || null,
      telemetry: equipment.last_telemetry,
      totalTreatments: equipment.treatments.length,
      treatments: formattedTreatments,
    },
  })
}
