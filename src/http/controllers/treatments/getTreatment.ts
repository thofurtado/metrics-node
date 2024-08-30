import { FastifyRequest, FastifyReply } from 'fastify'
import { z } from 'zod'
import { MakeGetTreatmentUseCase } from '@/use-cases/factories/make-get-treatment-use-case'

export async function getTreatment(request: FastifyRequest, reply: FastifyReply) {

    const getTreatmentsParamsSchema = z.object({
        id: z.string().uuid(),
    })

    const { id } = getTreatmentsParamsSchema.parse(request.params)

    let treatments
    try {
        const getTreatmentUseCase = MakeGetTreatmentUseCase()
        treatments = await getTreatmentUseCase.execute({
            treatmentId:id,
        })
    } catch (err) {
        if(err instanceof Error ){
            return reply.status(409).send({message: err.message})
        }

        throw err
    }
    return reply.status(200).send({
        treatments
    })
}


