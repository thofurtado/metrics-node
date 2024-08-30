import { FastifyRequest, FastifyReply } from 'fastify'
import { MakeGetTreatmentsUseCase } from '@/use-cases/factories/make-get-treatments-use-case'
import { z } from 'zod'

export async function getTreatments(request: FastifyRequest, reply: FastifyReply) {

    const getTreatmentsParamsSchema = z.object({
        page:z.string(),
        treatmentId: z.string().nullish(),
        clientName: z.string().nullish(),
        status: z.string().nullish()
    })

    const { page, treatmentId, clientName, status  } = getTreatmentsParamsSchema.parse(request.query)

    let treatments
    try {
        const getTreatmentUseCase = MakeGetTreatmentsUseCase()
        treatments = await getTreatmentUseCase.execute({
            pageIndex: parseInt(page),
            treatmentId: treatmentId ? treatmentId : undefined,
            clientName: clientName ? clientName : undefined,
            status: status ? status : undefined
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


