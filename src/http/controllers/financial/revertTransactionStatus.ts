import { FastifyRequest, FastifyReply } from 'fastify'
import { z } from 'zod'
import { MakeRevertTransactionStatusUseCase } from '@/use-cases/factories/make-revert-transaction-status-use-case'

export async function revertTransactionStatus(request: FastifyRequest, reply: FastifyReply) {
    const revertTransactionParamsSchema = z.object({
        id: z.string().uuid(),
    })

    const { id } = revertTransactionParamsSchema.parse(request.params)

    const revertTransactionStatusUseCase = MakeRevertTransactionStatusUseCase()

    await revertTransactionStatusUseCase.execute({
        id,
    })

    return reply.status(204).send()
}
