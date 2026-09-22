import { FastifyReply, FastifyRequest } from 'fastify'
import { z } from 'zod'
import { MakeReopenTreatmentUseCase } from '@/modules/treatments/use-cases/factories/make-reopen-treatment-use-case'
import { ResourceNotFoundError } from '@/errors/resource-not-found-error'

export async function reopen(request: FastifyRequest, reply: FastifyReply) {
    const paramsSchema = z.object({ id: z.string().uuid() })
    const { id } = paramsSchema.parse(request.params)

    try {
        const reopenTreatmentUseCase = MakeReopenTreatmentUseCase()
        const { treatment } = await reopenTreatmentUseCase.execute({ treatment_id: id })
        return reply.status(200).send({ treatment })
    } catch (err) {
        if (err instanceof ResourceNotFoundError) {
            return reply.status(404).send({ message: err.message })
        }
        if (err instanceof Error) {
            return reply.status(400).send({ message: err.message })
        }
        throw err
    }
}
