import { FastifyRequest, FastifyReply } from 'fastify'
import { z } from 'zod'
import { makeGetSuppliesUseCase } from '@/modules/items/use-cases/factories/make-get-supplies-use-case'

export async function getSupplies(request: FastifyRequest, reply: FastifyReply) {
    const getSuppliesQuerySchema = z.object({
        page: z.coerce.number().optional().default(1),
        limit: z.coerce.number().optional().default(10),
        is_active: z.enum(['true', 'false']).optional().transform((val) => {
            if (val === 'true') return true
            if (val === 'false') return false
            return undefined
        }),
        name: z.string().optional()
    })

    const { page, limit, is_active, name } = getSuppliesQuerySchema.parse(request.query)

    try {
        const getSuppliesUseCase = makeGetSuppliesUseCase()
        const { items, meta } = await getSuppliesUseCase.execute({
            page,
            limit,
            is_active,
            query: name
        })

        return reply.status(200).send({ items, meta })
    } catch (err) {
        if (err instanceof Error) {
            return reply.status(409).send({ message: err.message })
        }
        throw err
    }
}
