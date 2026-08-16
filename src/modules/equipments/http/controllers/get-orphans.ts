import { FastifyReply, FastifyRequest } from 'fastify'
import { makeGetOrphanEquipmentsUseCase } from '@/modules/equipments/use-cases/factories/make-get-orphan-equipments-use-case'

export async function getOrphans(
  request: FastifyRequest,
  reply: FastifyReply,
) {
  try {
    const getOrphanEquipmentsUseCase = makeGetOrphanEquipmentsUseCase()

    const { equipments } = await getOrphanEquipmentsUseCase.execute()

    return reply.status(200).send(equipments)
  } catch (err: any) {
    throw err
  }
}
