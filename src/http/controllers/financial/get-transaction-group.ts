import { FastifyReply, FastifyRequest } from 'fastify'
import { z } from 'zod'
import { MakeGetTransactionGroupUseCase } from '../../../use-cases/factories/make-get-transaction-group-use-case'

export async function getTransactionGroup(request: FastifyRequest, reply: FastifyReply) {
    const paramsSchema = z.object({
        groupId: z.string().uuid()
    })

    const { groupId } = paramsSchema.parse(request.params)

    try {
        const useCase = MakeGetTransactionGroupUseCase()
        const { group } = await useCase.execute({ groupId })

        return reply.status(200).send({ group })
    } catch (err) {
        if (err instanceof Error) {
            return reply.status(400).send({ message: err.message })
        }
        throw err
    }
}
