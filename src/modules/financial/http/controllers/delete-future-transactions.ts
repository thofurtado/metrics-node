import { FastifyReply, FastifyRequest } from 'fastify'
import { z } from 'zod'
import { MakeDeleteFutureTransactionsUseCase } from '@/modules/financial/use-cases/factories/make-delete-future-transactions-use-case'

export async function deleteFutureTransactions(request: FastifyRequest, reply: FastifyReply) {
    const paramsSchema = z.object({
        id: z.string().uuid()
    })

    const { id } = paramsSchema.parse(request.params)

    try {
        const useCase = MakeDeleteFutureTransactionsUseCase()
        await useCase.execute({ transactionId: id })

        return reply.status(204).send()
    } catch (err) {
        if (err instanceof Error) {
            return reply.status(400).send({ message: err.message })
        }
        throw err
    }
}
