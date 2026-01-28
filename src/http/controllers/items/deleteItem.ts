import { FastifyRequest, FastifyReply } from 'fastify'
import { z } from 'zod'
import { makeDeleteItemUseCase } from '@/use-cases/factories/make-delete-item-use-case'

export async function deleteItem(request: FastifyRequest, reply: FastifyReply) {
    const deleteItemParamsSchema = z.object({
        id: z.string().uuid(),
    })

    const { id } = deleteItemParamsSchema.parse(request.params)

    try {
        const deleteItemUseCase = makeDeleteItemUseCase()
        await deleteItemUseCase.execute({ itemId: id })
    } catch (err) {
        if (err instanceof Error) {
            return reply.status(400).send({ message: err.message })
        }
        throw err
    }

    return reply.status(204).send()
}
