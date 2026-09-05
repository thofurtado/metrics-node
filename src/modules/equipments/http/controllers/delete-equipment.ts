import { FastifyReply, FastifyRequest } from 'fastify'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'

export async function deleteEquipment(request: FastifyRequest, reply: FastifyReply) {
  const paramsSchema = z.object({
    id: z.string(),
  })

  const { id } = paramsSchema.parse(request.params)

  const existing = await prisma.equipment.findUnique({
    where: { id },
  })

  if (!existing) {
    return reply.status(404).send({ message: 'Equipamento não encontrado' })
  }

  // Desvincular tratamentos/atendimentos para preservar histórico contábil/financeiro
  await prisma.treatment.updateMany({
    where: { equipment_id: id },
    data: { equipment_id: null },
  })

  await prisma.equipment.delete({
    where: { id },
  })

  return reply.status(204).send()
}
