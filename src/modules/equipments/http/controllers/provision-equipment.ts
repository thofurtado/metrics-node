import { FastifyReply, FastifyRequest } from 'fastify'
import { z } from 'zod'
import { makeProvisionEquipmentUseCase } from '@/modules/equipments/use-cases/factories/make-provision-equipment-use-case'

export async function provisionEquipment(
  request: FastifyRequest,
  reply: FastifyReply,
) {
  const provisionBodySchema = z.object({
    identification: z.string(),
    type: z.string().default('Desktop'),
    hostname: z.string(),
  })

  const { identification, type, hostname } = provisionBodySchema.parse(request.body)

  try {
    const provisionEquipmentUseCase = makeProvisionEquipmentUseCase()

    const { equipment } = await provisionEquipmentUseCase.execute({
      identification,
      type,
      hostname,
    })

    return reply.status(201).send(equipment)
  } catch (err: any) {
    throw err
  }
}
