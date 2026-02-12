import { MakeTreatmentUseCase } from '@/modules/treatments/use-cases/factories/make-treatment-use-case'
import { FastifyRequest, FastifyReply } from 'fastify'
import { z } from 'zod'





export async function createTreatment(request: FastifyRequest, reply: FastifyReply) {

    const registerBodySchema = z.object({
        opening_date: z.coerce.date().nullish(),
        ending_date: z.coerce.date().nullish(),
        contact: z.string().nullish(),
        user_id: z.string().nullish(),
        client_id: z.string().nullish(),
        equipment_id: z.string().nullish(),
        request: z.string(),
        status: z.string().nullish(),
        amount: z.number().nullish(),
        observations: z.string().nullish(),
    })

    const { opening_date, ending_date, contact, user_id, client_id, equipment_id, request: requestString, status, amount, observations } = registerBodySchema.parse(request.body)

    // Explicitly handling request string from body, previously there was a redundant parse 'test'
    // request is a required field in zod schema, so it's guaranteed to be there if parse succeeds.

    let treatment
    try {

        const treatmentUseCase = MakeTreatmentUseCase()

        treatment = await treatmentUseCase.execute({
            opening_date: opening_date ? opening_date : new Date(),
            // Fix: If status is 'resolved', force ending_date to now. Otherwise use provided ending_date or undefined.
            ending_date: status === 'resolved' ? new Date() : (ending_date ? ending_date : undefined),
            contact: contact ? contact : undefined,
            user_id: user_id ? user_id : undefined,
            client_id: client_id ? client_id : undefined,
            equipment_id: equipment_id ? equipment_id : undefined,
            request: requestString,
            status: status ? status : 'pending',
            amount: amount ? amount : 0,
            observations: observations ? observations : undefined
        })
    } catch (err) {
        console.error("Create Treatment Error:", err) // Log error for debugging
        if (err instanceof Error) {
            return reply.status(409).send({ message: err.message })
        }

        throw err
    }
    return reply.status(201).send(treatment) // 201 Created is better for creation
}


