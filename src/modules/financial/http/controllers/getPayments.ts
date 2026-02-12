import { FastifyRequest, FastifyReply } from 'fastify'
import { MakeGetPaymentsUseCase } from '@/modules/financial/use-cases/factories/make-get-payments-use-case'

export async function getPayments(request: FastifyRequest, reply: FastifyReply) {

    let payments
    try {
        const getPaymentsUseCase = MakeGetPaymentsUseCase()
        payments = await getPaymentsUseCase.execute()
    } catch (err) {
        if(err instanceof Error ){
            return reply.status(409).send({message: err.message})
        }

        throw err
    }
    return reply.status(200).send(payments)
}