import { FastifyReply, FastifyRequest } from 'fastify'
import { z } from 'zod'
import { connectionManager } from '../../ws/connection-manager'
import { prisma } from '@/lib/prisma'

export async function sendCommand(
  request: FastifyRequest,
  reply: FastifyReply,
) {
  const sendCommandParamsSchema = z.object({
    id: z.string().uuid(),
  })

  const sendCommandBodySchema = z.object({
    command: z.string(),
  })

  const { id } = sendCommandParamsSchema.parse(request.params)
  const { command } = sendCommandBodySchema.parse(request.body)

  const equipment = await prisma.equipment.findUnique({
    where: { id },
  })

  if (!equipment) {
    return reply.status(404).send({ message: 'Equipamento não encontrado' })
  }

  const sent = connectionManager.sendCommand(id, command)

  if (!sent) {
    return reply.status(404).send({ message: 'Equipamento não está online ou conectado no momento.' })
  }

  return reply.status(200).send({ message: 'Comando enviado com sucesso.' })
}