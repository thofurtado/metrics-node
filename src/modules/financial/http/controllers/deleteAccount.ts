import { FastifyRequest, FastifyReply } from 'fastify'
import { z } from 'zod'
import { MakeDeleteAccountUseCase } from '@/modules/financial/use-cases/factories/make-delete-account-use-case'
import { ResourceNotFoundError } from '@/errors/resource-not-found-error'
import { ResourceDependencyError } from '@/errors/resource-dependency-error'

export async function deleteAccount(request: FastifyRequest, reply: FastifyReply) {
    const deleteAccountParamsSchema = z.object({
        id: z.string().uuid(),
    })

    const { id } = deleteAccountParamsSchema.parse(request.params)

    try {
        const deleteAccountUseCase = MakeDeleteAccountUseCase()

        await deleteAccountUseCase.execute({ id })
    } catch (err) {
        if (err instanceof ResourceNotFoundError) {
            return reply.status(404).send({ message: err.message })
        }
        // Mergulho 13:D2: conta em uso volta 409 com o motivo (antes: excluía soltando o histórico, ou erro 500)
        if (err instanceof ResourceDependencyError) {
            return reply.status(409).send({ message: err.message })
        }
        throw err
    }

    return reply.status(204).send()
}
