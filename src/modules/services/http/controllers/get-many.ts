import { FastifyReply, FastifyRequest } from 'fastify'
import { z } from 'zod'
import { makeGetServicesUseCase } from '@/modules/services/use-cases/factories/make-get-services-use-case'

export async function getMany(request: FastifyRequest, reply: FastifyReply) {
    const getServicesQuerySchema = z.object({
        page: z.coerce.number().min(1).default(1),
        perPage: z.coerce.number().min(1).default(10),
        query: z.string().optional(),
        active: z.coerce.boolean().optional(),
    })

    const { page, perPage, query, active } = getServicesQuerySchema.parse(request.query)

    const getServicesUseCase = makeGetServicesUseCase()

    const { services, count } = await getServicesUseCase.execute({
        page,
        perPage,
        query,
        active,
    })

    return reply.status(200).send({
        services: services.map(service => ({
            ...service,
            type: 'SERVICE',
            service: {
                display_id: service.display_id,
                price: service.price,
                estimated_time: service.estimated_time
            }
        })),
        meta: {
            pageIndex: page,
            perPage,
            totalCount: count
        }
    })
}
