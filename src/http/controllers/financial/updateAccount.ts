import { FastifyRequest, FastifyReply } from 'fastify'
import { z } from 'zod'
import { MakeUpdateAccountUseCase } from '@/use-cases/factories/make-update-account-use-case'
import { ResourceNotFoundError } from '@/use-cases/errors/resource-not-found-error'

export async function updateAccount(request: FastifyRequest, reply: FastifyReply) {
    const updateAccountParamsSchema = z.object({
        id: z.string().uuid(),
    })

    const updateAccountBodySchema = z.object({
        name: z.string().optional(),
        description: z.string().nullable().optional(),
        goal: z.number().nullable().optional(),
    })

    const { id } = updateAccountParamsSchema.parse(request.params)
    const { name, description, goal } = updateAccountBodySchema.parse(request.body)

    try {
        const updateAccountUseCase = MakeUpdateAccountUseCase()

        await updateAccountUseCase.execute({
            id,
            name,
            description,
            goal,
        })
    } catch (err) {
        if (err instanceof ResourceNotFoundError) {
            return reply.status(404).send({ message: err.message })
        }
        throw err
    }

    return reply.status(200).send()
}
