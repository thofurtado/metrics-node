import { FastifyReply, FastifyRequest } from 'fastify'
import { z } from 'zod'
import { makeUpdateProductUseCase } from '@/use-cases/factories/make-update-product-use-case'

export async function update(request: FastifyRequest, reply: FastifyReply) {
    const updateProductParamsSchema = z.object({
        id: z.string().uuid(),
    })

    const updateProductBodySchema = z.object({
        name: z.string().optional(),
        description: z.string().nullable().optional(),
        category: z.string().nullable().optional(),
        active: z.boolean().nullable().optional(),
        price: z.number().optional(),
        stock: z.number().nullable().optional(),
        min_stock: z.number().nullable().optional(),
        barcode: z.string().nullable().optional(),
        ncm: z.string().nullable().optional(),
        display_id: z.number().nullable().optional(),
        is_composite: z.boolean().optional(),
        cost: z.number().nullable().optional(),
        compositions: z.array(z.object({
            supply_id: z.string().uuid(),
            quantity: z.number()
        })).optional()
    })

    const { id } = updateProductParamsSchema.parse(request.params)
    const body = updateProductBodySchema.parse(request.body)

    const updateProductUseCase = makeUpdateProductUseCase()

    const { product } = await updateProductUseCase.execute({
        id,
        ...body
    })

    return reply.status(200).send(product)
}
