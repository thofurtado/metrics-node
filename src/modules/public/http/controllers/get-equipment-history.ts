import { FastifyReply, FastifyRequest } from 'fastify'
import { z } from 'zod'
import { prisma } from '../../../../lib/prisma'

export async function getEquipmentHistory(request: FastifyRequest, reply: FastifyReply) {
  const paramsSchema = z.object({
    id: z.string(),
  })

  const { id } = paramsSchema.parse(request.params)

  // Buscar por ID exato, por prefixo (ex: 8 primeiros dígitos) ou por identification
  const equipment = await prisma.equipment.findFirst({
    where: {
      OR: [
        { id },
        { id: { startsWith: id } },
        { identification: id },
      ],
    },
    include: {
      client: {
        select: {
          id: true,
          name: true,
          phone: true,
        },
      },
      treatments: {
        include: {
          items: {
            include: {
              product: {
                select: {
                  name: true,
                  price: true,
                },
              },
              service: {
                select: {
                  name: true,
                  price: true,
                },
              },
            },
          },
          interactions: {
            include: {
              users: {
                select: {
                  name: true,
                },
              },
            },
            orderBy: {
              created_at: 'asc',
            },
          },
          paymentEntrys: {
            include: {
              payments: {
                select: {
                  name: true,
                },
              },
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

  const formattedTreatments = equipment.treatments.map((t) => {
    const items = t.items.map((i) => {
      const unitPrice = i.salesValue ?? i.product?.price ?? i.service?.price ?? 0
      const quantity = i.quantity || 1
      return {
        id: i.id,
        name: i.product?.name || i.service?.name || i.observations || 'Serviço Especializado',
        type: i.product_id ? ('product' as const) : ('service' as const),
        quantity,
        unitPrice,
        totalPrice: unitPrice * quantity,
      }
    })

    const totalItemsAmount = items.reduce((acc, item) => acc + item.totalPrice, 0)
    const paymentsTotal = t.paymentEntrys.reduce((acc, p) => acc + (p.amount || 0), 0)
    const totalAmount = paymentsTotal > 0 ? paymentsTotal : totalItemsAmount

    const payments = t.paymentEntrys.map((p) => ({
      id: p.id,
      method: p.payments?.name || 'Pagamento',
      amount: p.amount,
      occurrences: p.occurrences,
    }))

    const isFinished = t.status === 'finished' || t.status === 'concluded' || t.status === 'done' || !!t.ending_date

    return {
      id: t.id,
      openingDate: t.opening_date || t.created_at,
      endingDate: t.ending_date,
      request: t.request || 'Revisão técnica preventiva e diagnóstico geral',
      status: t.status,
      observations: t.observations, // Laudo de encerramento
      items,
      totalAmount,
      payments,
      isPaid: isFinished || payments.length > 0,
      paidAt: t.ending_date || t.updated_at,
      interactions: t.interactions.map((inter) => ({
        id: inter.id,
        description: inter.description,
        authorName: inter.users?.name || 'Técnico Especialista',
        createdAt: inter.date || inter.created_at,
      })),
    }
  })

  return reply.status(200).send({
    equipment: {
      id: equipment.id,
      identification: equipment.identification || 'Computador Sem Nome',
      type: equipment.type,
      brand: equipment.brand || 'Personalizado',
      details: equipment.details,
      createdAt: equipment.created_at,
      clientName: equipment.client?.name || 'Cliente Particular',
      groupName: null,
      telemetry: equipment.last_telemetry,
      totalTreatments: equipment.treatments.length,
      treatments: formattedTreatments,
    },
  })
}
