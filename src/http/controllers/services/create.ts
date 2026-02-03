import { FastifyReply, FastifyRequest } from 'fastify'
import { z } from 'zod'
import { makeCreateServiceUseCase } from '@/use-cases/factories/make-create-service-use-case'

export async function create(request: FastifyRequest, reply: FastifyReply) {
    const createServiceBodySchema = z.object({
        name: z.string(),
        description: z.string().nullable().optional(),
        category: z.string().nullable().optional(),
        active: z.boolean().nullable().optional(),
        price: z.number(),
        display_id: z.number().nullable().optional(),
        estimated_time: z.string().nullable().optional(),
    })

    const body = createServiceBodySchema.parse(request.body)

    const createServiceUseCase = makeCreateServiceUseCase()

    const { service } = await createServiceUseCase.execute(body)

    return reply.status(201).send(service)
}
