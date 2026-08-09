import { FastifyRequest, FastifyReply } from 'fastify'
import { z } from 'zod'
import { MakeUpdateAccountUseCase } from '@/modules/financial/use-cases/factories/make-update-account-use-case'
import { ResourceNotFoundError } from '@/errors/resource-not-found-error'

export async function updateAccount(request: FastifyRequest, reply: FastifyReply) {
    const updateAccountParamsSchema = z.object({
        id: z.string().uuid(),
    })

    const updateAccountBodySchema = z.object({
        name: z.string().optional(),
        description: z.string().nullable().optional(),
        goal: z.number().nullable().optional(),
        is_transit: z.boolean().optional(),
    })

    const { id } = updateAccountParamsSchema.parse(request.params)
    const { name, description, goal, is_transit } = updateAccountBodySchema.parse(request.body)

    try {
        if (is_transit === true) {
            const { prisma } = require('@/lib/prisma')
            const existingTransit = await prisma.account.findFirst({ where: { is_transit: true, id: { not: id } } })
            if (existingTransit) {
                return reply.status(400).send({ message: 'Já existe uma conta transitória configurada. Apenas uma é permitida.' })
            }
        }

        const updateAccountUseCase = MakeUpdateAccountUseCase()

        await updateAccountUseCase.execute({
            id,
            name,
            description,
            goal,
            is_transit
        })
    } catch (err) {
        if (err instanceof ResourceNotFoundError) {
            return reply.status(404).send({ message: err.message })
        }
        throw err
    }

    return reply.status(200).send()
}
