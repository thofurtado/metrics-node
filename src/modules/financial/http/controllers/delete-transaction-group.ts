import { FastifyReply, FastifyRequest } from 'fastify'
import { z } from 'zod'
import { MakeDeleteTransactionGroupUseCase } from '@/modules/financial/use-cases/factories/make-delete-transaction-group-use-case'

export async function deleteTransactionGroup(request: FastifyRequest, reply: FastifyReply) {
    const paramsSchema = z.object({
        groupId: z.string().uuid()
    })

    const { groupId } = paramsSchema.parse(request.params)

    try {
        const useCase = MakeDeleteTransactionGroupUseCase()
        await useCase.execute({ groupId })

        return reply.status(204).send()
    } catch (err) {
        if (err instanceof Error) {
            return reply.status(400).send({ message: err.message })
        }
        throw err
    }
}
