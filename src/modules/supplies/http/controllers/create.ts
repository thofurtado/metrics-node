import { FastifyReply, FastifyRequest } from 'fastify'
import { z } from 'zod'
import { makeCreateSupplyUseCase } from '@/modules/supplies/use-cases/factories/make-create-supply-use-case'

export async function create(request: FastifyRequest, reply: FastifyReply) {
    const createSupplyBodySchema = z.object({
        name: z.string(),
        description: z.string().nullable().optional(),
        category: z.string().nullable().optional(),
        active: z.boolean().nullable().optional(),
        cost: z.number(),
        stock: z.number().nullable().optional(),
        unit: z.string().nullable().optional(),
    })

    const body = createSupplyBodySchema.parse(request.body)

    const createSupplyUseCase = makeCreateSupplyUseCase()

    const { supply } = await createSupplyUseCase.execute(body)

    return reply.status(201).send(supply)
}
