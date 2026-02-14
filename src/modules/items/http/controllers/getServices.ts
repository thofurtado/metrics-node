import { FastifyRequest, FastifyReply } from 'fastify'
import { z } from 'zod'
import { makeGetServicesUseCase } from '@/modules/items/use-cases/factories/make-get-services-use-case'

export async function getServices(request: FastifyRequest, reply: FastifyReply) {
    const getServicesQuerySchema = z.object({
        page: z.coerce.number().optional().default(1),
        limit: z.coerce.number().optional().default(10),
        is_active: z.enum(['true', 'false']).optional().transform((val) => {
            if (val === 'true') return true
            if (val === 'false') return false
            return undefined
        }),
        name: z.string().optional(),
        display_id: z.coerce.number().optional()
    })

    const { page, limit, is_active, name, display_id } = getServicesQuerySchema.parse(request.query)

    try {
        const getServicesUseCase = makeGetServicesUseCase()
        const { items, meta } = await getServicesUseCase.execute({
            page,
            limit,
            is_active,
            query: name,
            display_id
        })

        return reply.status(200).send({ items, meta })
    } catch (err) {
        if (err instanceof Error) {
            return reply.status(409).send({ message: err.message })
        }
        throw err
    }
}
