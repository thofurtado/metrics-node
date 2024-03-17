import { MakeTreatmentUseCase } from '@/use-cases/factories/make-treatment-use-case'
import { FastifyRequest, FastifyReply } from 'fastify'
import { z } from 'zod'





export async function createTreatment(request: FastifyRequest, reply: FastifyReply) {

    const registerBodySchema = z.object({
        opening_date: z.date().nullish(),
        ending_date: z.date().nullish(),
        contact: z.string().nullish(),
        user_id: z.string().nullish(),
        client_id: z.string().nullish(),
        equipment_id: z.string().nullish(),
        request: z.string(),
        finished: z.boolean().nullish(),
        amount: z.number().nullish(),
        observations: z.string().nullish(),
    })

    const { opening_date, ending_date, contact, user_id, client_id, equipment_id, finished, amount, observations } = registerBodySchema.parse(request.body)
    const test = registerBodySchema.parse(request.body)

    let treatment
    try {

        const treatmentUseCase = MakeTreatmentUseCase()

        treatment = await treatmentUseCase.execute({
            opening_date: opening_date ? opening_date : new Date(),
            ending_date: ending_date ? ending_date : undefined,
            contact: contact ? contact : undefined,
            user_id: user_id ? user_id : undefined,
            client_id: client_id ? client_id : undefined,
            equipment_id: equipment_id ? equipment_id : undefined,
            request: test.request,
            finished: finished ? finished : undefined,
            amount: amount ? amount : 0,
            observations: observations ? observations : undefined
        })
    } catch (err) {

        if(err instanceof Error ){
            return reply.status(409).send({message: err.message})
        }

        throw err
    }
    return reply.status(200).send(treatment)
}


