import { FastifyRequest, FastifyReply } from 'fastify'
import { z } from 'zod'
import { makeDeleteItemUseCase } from '@/modules/items/use-cases/factories/make-delete-item-use-case'
import { ResourceDependencyError } from '@/errors/resource-dependency-error'

export async function deleteItem(request: FastifyRequest, reply: FastifyReply) {
    const deleteItemParamsSchema = z.object({
        id: z.string().uuid(),
    })

    const { id } = deleteItemParamsSchema.parse(request.params)

    try {
        const deleteItemUseCase = makeDeleteItemUseCase()
        await deleteItemUseCase.execute({ itemId: id })
        return reply.status(204).send()
    } catch (err) {
        console.error('[DeleteItem Error]:', err)

        if (err instanceof ResourceDependencyError) {
            return reply.status(409).send({
                message: err.message
            })
        }

        if (err instanceof Error) {
            // Check for Prisma foreign key constraint violation (legacy check)
            if ('code' in err && (err as any).code === 'P2003') {
                return reply.status(409).send({
                    message: 'Não é possível excluir este item pois ele já possui vínculos no sistema (atendimentos ou movimentações). Tente desativá-lo.'
                })
            }
            return reply.status(400).send({ message: err.message })
        }
        throw err
    }
}
