import { FastifyReply, FastifyRequest } from 'fastify'
import { z } from 'zod'
import { makeCreateProductUseCase } from '@/modules/products/use-cases/factories/make-create-product-use-case'

export async function create(request: FastifyRequest, reply: FastifyReply) {
    const createProductBodySchema = z.object({
        name: z.string(),
        description: z.string().nullable().optional(),
        category: z.string().nullable().optional(),
        active: z.boolean().nullable().optional(),
        price: z.number(),
        stock: z.number().nullable().optional(),
        min_stock: z.number().nullable().optional(),
        barcode: z.string().nullable().optional(),
        ncm: z.string().nullable().optional(),
        display_id: z.number().nullable().optional(),
        is_composite: z.boolean().default(false),
        cost: z.number().nullable().optional(),
        compositions: z.array(z.object({
            supply_id: z.string().uuid(),
            quantity: z.number()
        })).optional()
    })

    const body = createProductBodySchema.parse(request.body)

    const createProductUseCase = makeCreateProductUseCase()

    const { product } = await createProductUseCase.execute(body)

    return reply.status(201).send(product)
}
