import { FastifyReply, FastifyRequest } from 'fastify'
import { z } from 'zod'
import { makeLinkEquipmentClientUseCase } from '@/modules/equipments/use-cases/factories/make-link-equipment-client-use-case'

export async function linkEquipmentClient(
  request: FastifyRequest,
  reply: FastifyReply,
) {
  const linkParamsSchema = z.object({
    id: z.string().uuid(),
  })

  const linkBodySchema = z.object({
    client_id: z.string().uuid(),
  })

  const { id } = linkParamsSchema.parse(request.params)
  const { client_id } = linkBodySchema.parse(request.body)

  try {
    const linkEquipmentClientUseCase = makeLinkEquipmentClientUseCase()

    await linkEquipmentClientUseCase.execute({
      id,
      client_id,
    })

    return reply.status(204).send()
  } catch (err: any) {
    if (err.message === 'Equipment not found') {
      return reply.status(404).send({ message: err.message })
    }
    throw err
  }
}
