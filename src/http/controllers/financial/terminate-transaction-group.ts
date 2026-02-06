import { FastifyReply, FastifyRequest } from 'fastify'
import { z } from 'zod'
import { MakeTerminateTransactionGroupUseCase } from '../../../use-cases/factories/make-terminate-transaction-group-use-case'

export async function terminateTransactionGroup(request: FastifyRequest, reply: FastifyReply) {
    const paramsSchema = z.object({
        groupId: z.string().uuid()
    })

    const bodySchema = z.object({
        lastKeptTransactionId: z.string().uuid()
    })

    const { groupId } = paramsSchema.parse(request.params)
    const { lastKeptTransactionId } = bodySchema.parse(request.body)

    try {
        const useCase = MakeTerminateTransactionGroupUseCase()

        await useCase.execute({
            groupId,
            lastKeptTransactionId
        })

        return reply.status(204).send()
    } catch (err) {
        if (err instanceof Error) {
            return reply.status(400).send({ message: err.message })
        }
        throw err
    }
}
