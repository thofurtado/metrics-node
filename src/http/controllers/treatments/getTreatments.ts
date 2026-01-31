import { FastifyRequest, FastifyReply } from 'fastify'
import { MakeGetTreatmentsUseCase } from '@/use-cases/factories/make-get-treatments-use-case'
import { z } from 'zod'

export async function getTreatments(request: FastifyRequest, reply: FastifyReply) {

    try {
        console.log('[GetTreatments] Query Params:', request.query)

        const getTreatmentsParamsSchema = z.object({
            page: z.coerce.string().default('1'),
            treatmentId: z.string().nullish(),
            clientName: z.string().nullish(),
            status: z.string().nullish()
        })

        const { page, treatmentId, clientName, status } = getTreatmentsParamsSchema.parse(request.query)

        const getTreatmentUseCase = MakeGetTreatmentsUseCase()
        const result = await getTreatmentUseCase.execute({
            pageIndex: parseInt(page),
            treatmentId: treatmentId || undefined, // Convert null/empty to undefined
            clientName: clientName || undefined,
            status: status || undefined
        })

        if (!result) {
            return reply.status(200).send({ treatments: [], totalCount: 0, perPage: 10, pageIndex: 1 })
        }

        return reply.status(200).send(result)
    } catch (err) {
        console.error('[GetTreatments] Error:', err)
        if (err instanceof Error) {
            // Return 500 for generic errors, not 409
            return reply.status(500).send({ message: err.message })
        }

        return reply.status(500).send({ message: 'Internal Server Error' })
    }
}
