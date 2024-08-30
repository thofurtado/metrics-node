import { MakeUpdateTreatmentUseCase } from '@/use-cases/factories/make-update-treatment-use-case'
import { FastifyRequest, FastifyReply } from 'fastify'
import { z } from 'zod'

export async function updateTreatment(request: FastifyRequest, reply: FastifyReply) {

    const updateTreatmentBodySchema = z.object({
        opening_date: z.coerce.date().nullish(),
        ending_date: z.coerce.date().nullish(),
        contact: z.string().nullish(),
        user_id: z.string().nullish(),
        client_id: z.string().nullish(),
        equipment_id: z.string().nullish(),
        request: z.string().nullish(),
        status: z.string().nullish(),
        amount: z.number().nullish(),
        observations: z.string().nullish(),
    })
    const idUpdateTreatmentBodySchema = z.object({
        id: z.string().uuid(),
    })
    const { opening_date, ending_date, contact, user_id, client_id, equipment_id,
        status, observations } = updateTreatmentBodySchema.parse(request.body)
    const { id } = idUpdateTreatmentBodySchema.parse(request.params)
    const test = updateTreatmentBodySchema.parse(request.body)
    let treatment
    try {
        const updateTreatmentUseCase = MakeUpdateTreatmentUseCase()
        treatment =  await updateTreatmentUseCase.execute({
            id,
            opening_date: opening_date ? opening_date : undefined,
            ending_date: ending_date ? ending_date : undefined,
            contact: contact ? contact : undefined,
            user_id: user_id ? user_id : undefined,
            client_id: client_id ? client_id : undefined,
            equipment_id: equipment_id ? equipment_id : undefined,
            request: test.request ? test.request : undefined,
            status: status ? status : undefined,
            observations: observations ? observations : undefined
        })
    } catch (err) {
        if (err) {
            return reply.status(409).send({ message: err.message })
        }
        throw err
    }
    return reply.status(200).send(treatment)
}


