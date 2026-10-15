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

  // Mergulho (08:W6): espera alguns segundos a resposta do Windy. Antes respondia "enviado" sem saber se ele recebeu.
  // Windy antigo não responde: segue como antes ("enviado", sem confirmação).
  const confirmacao = typeof sent === 'string'
    // ATUALIZAR_PDV: o Windy fala com o Serviço do PDV antes de responder (até ~20 s); o resto responde na hora
    ? await connectionManager.aguardarConfirmacao(id, sent, command === 'ATUALIZAR_PDV' ? 20000 : 8000)
    : { confirmado: false as const }

  if (confirmacao.confirmado && confirmacao.ok === false) {
    return reply.status(422).send({
      message: `O equipamento recebeu o comando, mas não conseguiu executar: ${confirmacao.detalhe || 'sem detalhe'}`,
      confirmado: true,
      ok: false,
    })
  }

  if (confirmacao.confirmado) {
    return reply.status(200).send({
      message: confirmacao.detalhe ? `O equipamento confirmou: ${confirmacao.detalhe}` : 'O equipamento confirmou o comando.',
      confirmado: true,
      ok: true,
    })
  }

  return reply.status(200).send({ message: 'Comando enviado com sucesso.', confirmado: false })
}
