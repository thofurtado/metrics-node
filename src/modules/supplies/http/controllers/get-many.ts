import { FastifyReply, FastifyRequest } from 'fastify'
import { z } from 'zod'
import { makeGetSuppliesUseCase } from '@/use-cases/factories/make-get-supplies-use-case'

export async function getMany(request: FastifyRequest, reply: FastifyReply) {
    const getSuppliesQuerySchema = z.object({
        page: z.coerce.number().min(1).default(1),
        perPage: z.coerce.number().min(1).default(10),
        query: z.string().optional(),
    })

    const { page, perPage, query } = getSuppliesQuerySchema.parse(request.query)

    const getSuppliesUseCase = makeGetSuppliesUseCase()

    const { supplies, count } = await getSuppliesUseCase.execute({
        page,
        perPage,
        query,
    })

    return reply.status(200).send({
        supplies: supplies.map(supply => ({
            ...supply,
            type: 'SUPPLY',
            supply: {
                cost: supply.cost,
                stock: supply.stock,
                unit: supply.unit
            }
        })),
        meta: {
            pageIndex: page,
            perPage,
            totalCount: count
        }
    })
}
