import { FastifyReply, FastifyRequest } from 'fastify'
import { z } from 'zod'
import { makeUpdateEquipmentTelemetryUseCase } from '@/modules/equipments/use-cases/factories/make-update-equipment-telemetry-use-case'

export async function updateTelemetry(
  request: FastifyRequest,
  reply: FastifyReply,
) {
  const updateTelemetryParamsSchema = z.object({
    id: z.string().uuid(),
  })

  const updateTelemetryBodySchema = z.object({
    cpu: z.any().optional(),
    mem: z.any().optional(),
    temp: z.any().optional(),
    fsSize: z.any().optional(),
    windowsEvents: z.any().optional(),
  }).passthrough()

  const { id } = updateTelemetryParamsSchema.parse(request.params)
  const telemetry = updateTelemetryBodySchema.parse(request.body)

  try {
    const updateEquipmentTelemetryUseCase = makeUpdateEquipmentTelemetryUseCase()

    await updateEquipmentTelemetryUseCase.execute({
      id,
      telemetry,
    })

    return reply.status(204).send()
  } catch (err: any) {
    if (err.message === 'Equipment not found') {
      return reply.status(404).send({ message: err.message })
    }
    throw err
  }
}
