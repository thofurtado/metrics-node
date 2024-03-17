import { MakePaymentEntryUseCase } from '@/use-cases/factories/make-payment-entry-use-case'
import { FastifyRequest, FastifyReply } from 'fastify'
import { z } from 'zod'





export async function createPaymentEntry(request: FastifyRequest, reply: FastifyReply) {

    const registerBodySchema = z.object({
        treatment_id: z.string(),
        payment_id: z.string(),
        amount: z.number(),
        occurrences: z.number()
    })

    const { treatment_id, payment_id, amount, occurrences } = registerBodySchema.parse(request.body)
    let paymentEntry
    try {

        const paymentEntryUseCase = MakePaymentEntryUseCase()

        paymentEntry = await paymentEntryUseCase.execute({
            treatment_id,
            payment_id,
            amount,
            occurrences
        })
    } catch (err) {

        if(err instanceof Error ){
            return reply.status(409).send({message: err.message})
        }

        throw err
    }
    return reply.status(200).send(paymentEntry)
}


