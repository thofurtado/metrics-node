import { FastifyReply, FastifyRequest } from 'fastify'
import { z } from 'zod'
import { MakeFinishTreatmentUseCase } from '@/modules/treatments/use-cases/factories/make-finish-treatment-use-case'
import { ResourceNotFoundError } from '@/errors/resource-not-found-error'

export async function finish(request: FastifyRequest, reply: FastifyReply) {
    const finishTreatmentParamsSchema = z.object({
        id: z.string().uuid(),
    })

    const finishTreatmentBodySchema = z.object({
        payments: z.array(z.object({
            payment_id: z.string(),
            amount: z.number(),
            occurrences: z.number(),
            date: z.string().optional(),
            is_paid: z.boolean().optional(),
            description: z.string().optional(),
        })).optional()
    }).optional()

    const { id } = finishTreatmentParamsSchema.parse(request.params)
    const body = request.body ? finishTreatmentBodySchema.parse(request.body) : undefined

    try {
        const finishTreatmentUseCase = MakeFinishTreatmentUseCase()

        await finishTreatmentUseCase.execute({
            treatment_id: id,
            payments: body?.payments,
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
