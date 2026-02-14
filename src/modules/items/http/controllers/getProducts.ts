import { FastifyRequest, FastifyReply } from 'fastify'
import { z } from 'zod'
import { makeGetProductsUseCase } from '@/modules/items/use-cases/factories/make-get-products-use-case'

export async function getProducts(request: FastifyRequest, reply: FastifyReply) {
    const getProductsQuerySchema = z.object({
        page: z.coerce.number().optional().default(1),
        limit: z.coerce.number().optional().default(10),
        is_active: z.enum(['true', 'false']).optional().transform((val) => {
            if (val === 'true') return true
            if (val === 'false') return false
            return undefined
        }),
        name: z.string().optional(),
        display_id: z.coerce.number().optional(),
        below_min_stock: z.enum(['true', 'false']).optional().transform((val) => val === 'true')
    })

    const { page, limit, is_active, name, display_id, below_min_stock } = getProductsQuerySchema.parse(request.query)

    try {
        const getProductsUseCase = makeGetProductsUseCase()
        const { items, meta } = await getProductsUseCase.execute({
            page,
            limit,
            is_active,
            query: name,
            display_id,
            below_min_stock
        })

        return reply.status(200).send({ items, meta })
    } catch (err) {
        if (err instanceof Error) {
            return reply.status(409).send({ message: err.message })
        }
        throw err
    }
}
