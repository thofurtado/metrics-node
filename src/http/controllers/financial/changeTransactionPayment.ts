import { MakeChangeTransactionStatusUseCase } from '@/use-cases/factories/make-change-transaction-status'
import { FastifyRequest, FastifyReply } from 'fastify'
import { z } from 'zod'

export async function changeTransactionStatus(request: FastifyRequest, reply: FastifyReply) {

    const idUpdateTreatmentBodySchema = z.object({
        id: z.string().uuid()
    })

    const { id } = idUpdateTreatmentBodySchema.parse(request.params)

    try {
        const changeTransactionStatusUseCase = MakeChangeTransactionStatusUseCase()
        await changeTransactionStatusUseCase.execute({
            id,
        })
    } catch (err) {
        if (err) {
            return reply.status(409).send({ message: err.message })
        }
        throw err
    }
    return reply.status(200).send()
}


