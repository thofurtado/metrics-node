import { FastifyReply, FastifyRequest } from 'fastify'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'

export async function updateEquipment(request: FastifyRequest, reply: FastifyReply) {
  const paramsSchema = z.object({
    id: z.string(),
  })

  const bodySchema = z.object({
    identification: z.string().nullable().optional(),
    type: z.string().optional(),
    brand: z.string().nullable().optional(),
    details: z.string().nullable().optional(),
    client_id: z.string().nullable().optional(),
  })

  const { id } = paramsSchema.parse(request.params)
  const data = bodySchema.parse(request.body)

  const existing = await prisma.equipment.findUnique({
    where: { id },
  })

  if (!existing) {
    return reply.status(404).send({ message: 'Equipamento não encontrado' })
  }

  const updateData: any = {}
  if (data.identification !== undefined) updateData.identification = data.identification
  if (data.type !== undefined) updateData.type = data.type.trim()
  if (data.brand !== undefined) updateData.brand = data.brand
  if (data.details !== undefined) updateData.details = data.details
  if (data.client_id !== undefined) updateData.client_id = data.client_id

  const updated = await prisma.equipment.update({
    where: { id },
    data: updateData,
  })

  return reply.status(200).send(updated)
}
