import { MakePaymentUseCase } from '@/modules/financial/use-cases/factories/make-payment-use-case'
import { FastifyRequest, FastifyReply } from 'fastify'
import { z } from 'zod'





export async function createPayment(request: FastifyRequest, reply: FastifyReply) {

    const registerBodySchema = z.object({
        name: z.string(),
        installment_limit: z.number(),
        in_sight: z.boolean(),
        // Sem conta só a forma do tipo Plataforma (o repasse cai na conta da plataforma)
        account_id: z.string().optional().nullable(),
        // Tipo da forma (15/10/2026): nulo = comum; 'PLATAFORMA' = paga no app do iFood/99
        kind: z.enum(['PLATAFORMA']).optional().nullable(),
    })

    const { name, installment_limit, in_sight, account_id, kind } = registerBodySchema.parse(request.body)
    let payment
    try {

        const paymentUseCase = MakePaymentUseCase()

        payment = await paymentUseCase.execute({
            name,
            installment_limit,
            in_sight,
            account_id: account_id || undefined,
            kind: kind ?? null,
        })
    } catch (err) {

        if(err instanceof Error ){
            return reply.status(409).send({message: err.message})
        }

        throw err
    }
    return reply.status(200).send(payment)
}


