import { FastifyRequest, FastifyReply } from 'fastify'
import { z } from 'zod'
import { MakeGetItemsUseCase } from '@/use-cases/factories/make-get-items-use-case'
import { ItemType } from '@prisma/client'

export async function getItems(request: FastifyRequest, reply: FastifyReply) {
    const getItemsQuerySchema = z.object({
        page: z.coerce.number().optional().default(1),
        limit: z.coerce.number().optional().default(6),
        is_active: z.enum(['true', 'false']).optional().transform((val) => {
            if (val === 'true') return true
            if (val === 'false') return false
            return undefined
        }),
        type: z.nativeEnum(ItemType).optional(),
        name: z.string().optional(),
        display_id: z.coerce.number().optional(),
        below_min_stock: z.enum(['true', 'false']).optional().transform((val) => val === 'true')
    })

    const { page, limit, is_active, type, name, display_id, below_min_stock } = getItemsQuerySchema.parse(request.query)

    try {
        const getItemUseCase = MakeGetItemsUseCase()
        const result = await getItemUseCase.execute({
            page,
            limit,
            is_active,
            type,
            name,
            display_id,
            below_min_stock: below_min_stock
        })

        return reply.status(200).send(result)
    } catch (err) {
        if (err instanceof Error) {
            return reply.status(409).send({ message: err.message })
        }
        throw err
    }
}
