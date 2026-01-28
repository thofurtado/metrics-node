import { FastifyRequest, FastifyReply } from 'fastify'
import { z } from 'zod'
import { MakeDeletePaymentUseCase } from '@/use-cases/factories/make-delete-payment-use-case'
import { ResourceNotFoundError } from '@/use-cases/errors/resource-not-found-error'

export async function deletePayment(request: FastifyRequest, reply: FastifyReply) {
    const deletePaymentParamsSchema = z.object({
        id: z.string().uuid(),
    })

    const { id } = deletePaymentParamsSchema.parse(request.params)

    try {
        const deletePaymentUseCase = MakeDeletePaymentUseCase()

        await deletePaymentUseCase.execute({ id })
    } catch (err) {
        if (err instanceof ResourceNotFoundError) {
            return reply.status(404).send({ message: err.message })
        }
        throw err
    }

    return reply.status(204).send()
}
