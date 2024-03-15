import { MakePaymentUseCase } from '@/use-cases/factories/make-payment-use-case'
import { FastifyRequest, FastifyReply } from 'fastify'
import { z } from 'zod'





export async function createPayment(request: FastifyRequest, reply: FastifyReply) {

    const registerBodySchema = z.object({
        name: z.string(),
        installment_limit: z.number(),
        in_sight: z.boolean(),
        account_id: z.string()
    })

    const { name, installment_limit, in_sight, account_id } = registerBodySchema.parse(request.body)
    let payment
    try {

        const paymentUseCase = MakePaymentUseCase()

        payment = await paymentUseCase.execute({
            name,
            installment_limit,
            in_sight,
            account_id
        })
    } catch (err) {

        return reply.status(409).send()

        throw err
    }
    return reply.status(200).send(payment)
}


