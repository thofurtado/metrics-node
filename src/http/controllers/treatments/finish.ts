import { FastifyReply, FastifyRequest } from 'fastify'
import { z } from 'zod'
import { MakeFinishTreatmentUseCase } from '@/use-cases/factories/make-finish-treatment-use-case'
import { ResourceNotFoundError } from '@/use-cases/errors/resource-not-found-error'

export async function finish(request: FastifyRequest, reply: FastifyReply) {
    const finishTreatmentParamsSchema = z.object({
        id: z.string().uuid(),
    })

    const { id } = finishTreatmentParamsSchema.parse(request.params)

    try {
        const finishTreatmentUseCase = MakeFinishTreatmentUseCase()

        await finishTreatmentUseCase.execute({
            treatment_id: id,
        })

        return reply.status(200).send({ message: 'Treatment finished successfully' })
    } catch (err) {
        if (err instanceof ResourceNotFoundError) {
            return reply.status(404).send({ message: err.message })
        }
        // Handle other specific errors (insufficient payment, etc)
        if (err instanceof Error) {
            return reply.status(400).send({ message: err.message })
        }

        throw err
    }
}
