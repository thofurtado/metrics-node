import { FastifyReply, FastifyRequest } from 'fastify'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'

export async function createEquipment(request: FastifyRequest, reply: FastifyReply) {
  const bodySchema = z.object({
    client_id: z.string().nullable().optional(),
    type: z.string().default('computador'),
    brand: z.string().nullable().optional(),
    identification: z.string().nullable().optional(),
    details: z.string().nullable().optional(),
    entry: z.coerce.date().optional(),
  })

  const { client_id, type, brand, identification, details, entry } = bodySchema.parse(request.body)

  if (client_id) {
    const clientExists = await prisma.client.findUnique({ where: { id: client_id } })
    if (!clientExists) {
      return reply.status(404).send({ message: 'Cliente não encontrado' })
    }
  }

  const equipment = await prisma.equipment.create({
    data: {
      client_id: client_id || null,
      type: (type && type.trim()) || 'computador',
      brand: brand || null,
      identification: identification || null,
      details: details || null,
      entry: entry || new Date(),
    },
  })

  return reply.status(201).send(equipment)
}
